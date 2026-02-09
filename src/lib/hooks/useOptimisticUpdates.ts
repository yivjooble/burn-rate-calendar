"use client";

import { useCallback, useState } from "react";
import { mutate } from "swr";
import { toast } from "sonner";
import { useSettings, useBudget, useCategories } from "@/lib/hooks/useBudget";
import { UserSettings, CustomCategory, MonthBudget } from "@/types";

// =============================================================================
// OPTIMISTIC UPDATE EXAMPLES
// These functions demonstrate how to implement optimistic updates
// for different operations in BRC
// =============================================================================

/**
 * Example 1: Optimistically update settings
 * 
 * Pattern:
 * 1. Immediately update local cache (optimistic)
 * 2. Send request to server
 * 3. If successful, revalidate from server
 * 4. If failed, rollback and revalidate
 */
export function useOptimisticSettings() {
  const { settings, mutate: mutateSettings } = useSettings();

  const updateSettings = useCallback(
    async (newSettings: Partial<UserSettings>) => {
      // Store current settings for rollback
      const previousSettings = settings;

      // Step 1: Optimistic update - immediately update cache
      await mutateSettings(
        (current: UserSettings | undefined) => ({
          ...current,
          ...newSettings,
        }),
        false // Don't revalidate yet
      );

      try {
        // Step 2: Send to server
        const response = await fetch("/api/db/user-settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settings: newSettings }),
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to save settings");
        }

        // Step 3: Revalidate from server
        await mutateSettings();
        
        // Also trigger budget revalidation as settings affect budget
        await mutate("/api/db/budget");
      } catch (error) {
        // Step 4: Rollback on error
        console.error("Failed to update settings:", error);
        toast.error("Не вдалося зберегти налаштування");
        await mutateSettings(previousSettings, false);
        await mutateSettings(); // Revalidate from server
        throw error;
      }
    },
    [settings, mutateSettings]
  );

  return { settings, updateSettings };
}

/**
 * Example 2: Optimistically update categories
 */
export function useOptimisticCategories() {
  const { categories, mutate: mutateCategories } = useCategories();

  const updateCategories = useCallback(
    async (
      action: "add" | "remove" | "update" | "replace",
      category?: CustomCategory | { id: string },
      allCategories?: CustomCategory[]
    ) => {
      const previousCategories = categories;

      // Step 1: Optimistic update
      let newCategories: CustomCategory[];

      switch (action) {
        case "add":
          newCategories = category
            ? [...categories, category as CustomCategory]
            : categories;
          break;
        case "remove":
          newCategories = categories.filter(
            (c) => c.id !== (category as { id: string }).id
          );
          break;
        case "update":
          newCategories = categories.map((c) =>
            c.id === (category as CustomCategory).id
              ? (category as CustomCategory)
              : c
          );
          break;
        case "replace":
          newCategories = allCategories || [];
          break;
        default:
          newCategories = categories;
      }

      await mutateCategories(newCategories, false);

      try {
        // Step 2: Send to server
        const response = await fetch("/api/db/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ categories: newCategories }),
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to save categories");
        }

        // Step 3: Revalidate
        await mutateCategories();
      } catch (error) {
        // Step 4: Rollback
        console.error("Failed to update categories:", error);
        toast.error("Не вдалося зберегти категорії");
        await mutateCategories(previousCategories, false);
        await mutateCategories();
        throw error;
      }
    },
    [categories, mutateCategories]
  );

  return { categories, updateCategories };
}

/**
 * Example 3: Optimistically exclude/include a transaction
 * 
 * This updates the budget immediately before the server confirms,
 * giving instant feedback to the user
 */
export function useOptimisticTransactionExclusion() {
  const { budget, mutate: mutateBudget } = useBudget();

  const excludeTransaction = useCallback(
    async (transactionId: string) => {
      if (!budget) return;

      // Find the transaction to calculate spent change
      let spentChange = 0;
      
      const newDailyLimits = budget.dailyLimits.map((day) => {
        const tx = day.transactions?.find((t) => t.id === transactionId);
        
        if (tx) {
          spentChange = Math.abs(tx.amount);
          
          return {
            ...day,
            spent: day.spent - spentChange,
            remaining: day.limit - (day.spent - spentChange),
          };
        }
        
        return day;
      });

      // ✅ FIX: Recalculate totals
      const newBudget: MonthBudget = {
        ...budget,
        totalSpent: budget.totalSpent - spentChange,
        totalRemaining: budget.totalRemaining + spentChange,
        dailyLimits: newDailyLimits,
      };

      // Optimistically update
      await mutateBudget(newBudget, false);

      try {
        // Send to server
        await fetch("/api/db/excluded", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: transactionId, action: "add" }),
          credentials: "include",
        });

        // Revalidate budget from server
        await mutateBudget();
      } catch (error) {
        console.error("Failed to exclude transaction:", error);
        toast.error("Не вдалося виключити транзакцію");
        await mutateBudget(); // Rollback via revalidation
        throw error;
      }
    },
    [budget, mutateBudget]
  );

  const includeTransaction = useCallback(
    async (transactionId: string) => {
      if (!budget) return;

      // Find the transaction to calculate spent change
      let spentChange = 0;
      
      const newDailyLimits = budget.dailyLimits.map((day) => {
        const tx = day.transactions?.find((t) => t.id === transactionId);
        
        if (tx) {
          spentChange = Math.abs(tx.amount);
          
          return {
            ...day,
            spent: day.spent + spentChange,
            remaining: day.limit - (day.spent + spentChange),
          };
        }
        
        return day;
      });

      // Recalculate totals
      const newBudget: MonthBudget = {
        ...budget,
        totalSpent: budget.totalSpent + spentChange,
        totalRemaining: budget.totalRemaining - spentChange,
        dailyLimits: newDailyLimits,
      };

      // Optimistically update
      await mutateBudget(newBudget, false);

      try {
        await fetch("/api/db/excluded", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: transactionId, action: "remove" }),
          credentials: "include",
        });

        await mutateBudget();
      } catch (error) {
        console.error("Failed to include transaction:", error);
        toast.error("Не вдалося включити транзакцію");
        await mutateBudget();
        throw error;
      }
    },
    [budget, mutateBudget]
  );

  return { excludeTransaction, includeTransaction };
}

/**
 * Example 4: Background sync → mutate pattern
 * 
 * After syncing data from Monobank, trigger SWR revalidation
 * to update all clients in real-time
 * 
 * ✅ FIX: Added race condition guards with isSyncing state
 */
export function useBackgroundSync() {
  const [isSyncing, setIsSyncing] = useState(false);
  const { mutate: mutateSettings } = useSettings();
  const { mutate: mutateBudget } = useBudget();
  const { mutate: mutateCategories } = useCategories();

  const performSync = useCallback(
    async (accountId: string) => {
      // Guard: skip if already syncing
      if (isSyncing) {
        console.log('Sync already in progress, skipping...');
        return false;
      }

      setIsSyncing(true);
      try {
        // Import sync functions dynamically
        const { refreshTodayTransactions, incrementalSync } = await import(
          "@/lib/mono-sync"
        );

        // Perform sync
        await refreshTodayTransactions([accountId]);
        await incrementalSync([accountId]);

        // Trigger SWR revalidation for all data
        await Promise.all([
          mutateSettings(),
          mutateBudget(),
          mutateCategories(),
        ]);

        return true;
      } catch (error) {
        console.error("Background sync failed:", error);
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [isSyncing, mutateSettings, mutateBudget, mutateCategories]
  );

  return { performSync, isSyncing };
}

/**
 * Example 5: Real-time balance updates
 * 
 * For accounts with live balance updates,
 * poll more frequently during active usage
 */
export function useRealTimeBalance() {
  const { settings, mutate: mutateSettings } = useSettings();
  const { budget, mutate: mutateBudget } = useBudget();

  const refreshBalance = useCallback(async () => {
    if (!settings?.accountId) return;

    try {
      const response = await fetch("/api/mono/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: "/personal/client-info" }),
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        const account = data.accounts?.find(
          (a: { id: string }) => a.id === settings.accountId
        );

        if (account) {
          // Optimistically update settings
          await mutateSettings(
            {
              accountBalance: account.balance,
              accountCurrency: account.currencyCode,
            },
            false
          );

          // Trigger budget recalculation
          await mutateBudget();
        }
      }
    } catch (error) {
      console.error("Failed to refresh balance:", error);
      toast.error("Не вдалося оновити баланс");
    }
  }, [settings?.accountId, mutateSettings, mutateBudget]);

  return { refreshBalance };
}
