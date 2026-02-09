import useSWR, { mutate } from "swr";
import { UserSettings, MonthBudget, CustomCategory } from "@/types";

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    throw new Error("Failed to fetch");
  }
  return res.json();
};

// =============================================================================
// SWR Hooks for BRC Real-time Updates
// =============================================================================

/**
 * Hook for fetching and managing user settings with real-time updates
 * Refreshes every 30 seconds
 */
export function useSettings() {
  const { data, error, isLoading, mutate } = useSWR<UserSettings>(
    "/api/db/user-settings",
    fetcher,
    {
      refreshInterval: 30000, // 30 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000,
    }
  );

  return {
    settings: data,
    isLoading,
    isError: error,
    mutate,
  };
}

/**
 * Hook for fetching and managing budget with real-time updates
 * Refreshes every 10 seconds for live updates
 */
export function useBudget(options?: { accountId?: string; month?: string }) {
  const queryParams = new URLSearchParams();
  if (options?.accountId) queryParams.set("accountId", options.accountId);
  if (options?.month) queryParams.set("month", options.month);
  
  const url = `/api/db/budget${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

  const { data, error, isLoading, mutate } = useSWR<MonthBudget>(
    url,
    fetcher,
    {
      refreshInterval: 10000, // 10 seconds for live updates
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
    }
  );

  return {
    budget: data,
    isLoading,
    isError: error,
    mutate,
  };
}

/**
 * Hook for fetching user categories
 */
export function useCategories() {
  const { data, error, isLoading, mutate } = useSWR<CustomCategory[]>(
    "/api/db/categories",
    fetcher,
    {
      refreshInterval: 60000, // 1 minute - categories don't change often
      revalidateOnFocus: true,
      dedupingInterval: 10000,
    }
  );

  return {
    categories: data || [],
    isLoading,
    isError: error,
    mutate,
  };
}

// =============================================================================
// Optimistic Update Functions
// =============================================================================

/**
 * Optimistically update settings
 * Immediately updates local cache, then syncs to server
 */
export async function updateSettingsOptimistic(
  newSettings: Partial<UserSettings>,
  mutateSettings: (settings: UserSettings | false) => Promise<void>
) {
  // Get current settings for optimistic update
  const { settings: currentSettings } = useSettings();
  
  // Create optimistic settings
  const optimisticSettings: UserSettings = {
    ...currentSettings,
    ...newSettings,
  };

  // Optimistically update
  await mutateSettings(optimisticSettings);

  try {
    // Send to server
    const response = await fetch("/api/db/user-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: newSettings }),
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to save settings");
    }

    // Revalidate from server
    await mutate("/api/db/user-settings");
  } catch (error) {
    console.error("Failed to save settings:", error);
    // Revert on error (revalidate will fetch fresh data)
    await mutate("/api/db/user-settings");
    throw error;
  }
}

/**
 * Optimistically update categories
 */
export async function updateCategoriesOptimistic(
  newCategories: CustomCategory[],
  mutateCategories: (categories: CustomCategory[] | false) => Promise<void>
) {
  // Optimistically update
  await mutateCategories(newCategories);

  try {
    // Send to server
    const response = await fetch("/api/db/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories: newCategories }),
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error("Failed to save categories");
    }

    // Revalidate from server
    await mutate("/api/db/categories");
  } catch (error) {
    console.error("Failed to save categories:", error);
    // Revert on error
    await mutate("/api/db/categories");
    throw error;
  }
}

/**
 * Trigger budget recalculation
 */
export async function recalculateBudget() {
  await mutate("/api/db/budget");
}

/**
 * Trigger full data refresh after sync
 */
export async function refreshAllData() {
  await Promise.all([
    mutate("/api/db/user-settings"),
    mutate("/api/db/budget"),
    mutate("/api/db/categories"),
  ]);
}
