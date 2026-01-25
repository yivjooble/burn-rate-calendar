import { create } from "zustand";
import { persist } from "zustand/middleware";
import { UserSettings, MonthBudget, InflationPrediction, Transaction, MonoAccount } from "@/types";

export interface CustomCategory {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface BudgetState {
  settings: UserSettings;
  monthBudget: MonthBudget | null;
  inflationPrediction: InflationPrediction | null;
  transactions: Transaction[];
  excludedTransactionIds: string[];
  includedTransactionIds: string[]; // Override auto-exclusion (internal transfers, ATM)
  customCategories: CustomCategory[];
  transactionCategories: Record<string, string>; // transactionId -> categoryId
  transactionComments: Record<string, string>; // transactionId -> comment
  cachedAccounts: MonoAccount[]; // Cached Monobank accounts to avoid rate limiting
  isLoading: boolean;
  isHistoricalLoading: boolean; // Historical data sync in progress
  error: string | null;
  dbInitialized: boolean;

  setSettings: (settings: Partial<UserSettings>) => void;
  setMonthBudget: (budget: MonthBudget) => void;
  setInflationPrediction: (prediction: InflationPrediction) => void;
  setTransactions: (transactions: Transaction[]) => void;
  excludeTransaction: (transactionId: string) => void;
  includeTransaction: (transactionId: string) => void;
  includeAutoExcluded: (transactionId: string) => void; // Override auto-exclusion
  removeIncludeOverride: (transactionId: string) => void; // Remove override
  addCustomCategory: (category: CustomCategory) => void;
  removeCustomCategory: (categoryId: string) => void;
  setTransactionCategory: (transactionId: string, categoryId: string | null) => void;
  setTransactionComment: (transactionId: string, comment: string) => void;
  setCachedAccounts: (accounts: MonoAccount[]) => void;
  setLoading: (loading: boolean) => void;
  setHistoricalLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  initFromDb: () => Promise<void>;
  syncToDb: () => Promise<void>;
}

const initialSettings: UserSettings = {
  accountId: "",
  accountBalance: 0,
  accountCurrency: 980, // UAH by default
};

export const useBudgetStore = create<BudgetState>()(
  persist(
    (set, get) => ({
      settings: initialSettings,
      monthBudget: null,
      inflationPrediction: null,
      transactions: [],
      excludedTransactionIds: [],
      includedTransactionIds: [],
      customCategories: [],
      transactionCategories: {},
      transactionComments: {},
      cachedAccounts: [],
      isLoading: false,
      isHistoricalLoading: false,
      error: null,
      dbInitialized: false,

      setSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
        // Sync to DB - only sync the changed settings (excluding monoToken)
        Object.entries(newSettings)
          .filter(([key]) => key !== "monoToken")
          .forEach(([key, value]) => {
            if (value !== undefined) {
              // Convert arrays to JSON strings for storage
              const stringValue = Array.isArray(value) ? JSON.stringify(value) : String(value);
              fetch("/api/db/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ key, value: stringValue }),
                credentials: "include",
              }).catch(console.error);
            }
          });
      },

      setMonthBudget: (budget) => set({ monthBudget: budget }),

      setInflationPrediction: (prediction) =>
        set({ inflationPrediction: prediction }),

      setTransactions: (transactions) => {
        set({ transactions });
        // Sync to DB
        fetch("/api/db/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactions }),
          credentials: "include",
        }).catch(console.error);
      },

      excludeTransaction: (transactionId) => {
        set((state) => ({
          excludedTransactionIds: [...state.excludedTransactionIds, transactionId],
        }));
        // Sync to DB
        fetch("/api/db/excluded", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: transactionId, action: "add" }),
          credentials: "include",
        }).catch(console.error);
      },

      includeTransaction: (transactionId) => {
        set((state) => ({
          excludedTransactionIds: state.excludedTransactionIds.filter(
            (id) => id !== transactionId
          ),
        }));
        // Sync to DB
        fetch("/api/db/excluded", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: transactionId, action: "remove" }),
          credentials: "include",
        }).catch(console.error);
      },

      includeAutoExcluded: (transactionId) => {
        set((state) => ({
          includedTransactionIds: [...state.includedTransactionIds, transactionId],
        }));
        // Sync to DB
        fetch("/api/db/included", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: transactionId, action: "add" }),
          credentials: "include",
        }).catch(console.error);
      },

      removeIncludeOverride: (transactionId) => {
        set((state) => ({
          includedTransactionIds: state.includedTransactionIds.filter(
            (id) => id !== transactionId
          ),
        }));
        // Sync to DB
        fetch("/api/db/included", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: transactionId, action: "remove" }),
          credentials: "include",
        }).catch(console.error);
      },

      addCustomCategory: (category) => {
        set((state) => ({
          customCategories: [...state.customCategories, category],
        }));
      },

      removeCustomCategory: (categoryId) => {
        set((state) => ({
          customCategories: state.customCategories.filter((c) => c.id !== categoryId),
          transactionCategories: Object.fromEntries(
            Object.entries(state.transactionCategories).filter(([, catId]) => catId !== categoryId)
          ),
        }));
      },

      setTransactionCategory: (transactionId, categoryId) => {
        set((state) => {
          const newCategories = { ...state.transactionCategories };
          if (categoryId === null) {
            delete newCategories[transactionId];
          } else {
            newCategories[transactionId] = categoryId;
          }
          return { transactionCategories: newCategories };
        });
      },

      setTransactionComment: (transactionId, comment) => {
        set((state) => {
          const newComments = { ...state.transactionComments };
          if (!comment.trim()) {
            delete newComments[transactionId];
          } else {
            newComments[transactionId] = comment.trim();
          }
          return { transactionComments: newComments };
        });
        // Sync to DB
        fetch("/api/db/transaction-comments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ transactionId, comment: comment.trim() || null }),
          credentials: "include",
        }).catch(console.error);
      },

      setCachedAccounts: (accounts) => set({ cachedAccounts: accounts }),

      setLoading: (loading) => set({ isLoading: loading }),

      setHistoricalLoading: (loading) => set({ isHistoricalLoading: loading }),

      setError: (error) => set({ error }),

      reset: () =>
        set({
          settings: initialSettings,
          monthBudget: null,
          inflationPrediction: null,
          transactions: [],
          excludedTransactionIds: [],
          includedTransactionIds: [],
          customCategories: [],
          transactionCategories: {},
          transactionComments: {},
          cachedAccounts: [],
          isLoading: false,
          isHistoricalLoading: false,
          error: null,
          dbInitialized: false,
        }),

      initFromDb: async () => {
        try {
          const [settingsRes, transactionsRes, excludedRes, includedRes] = await Promise.all([
            fetch("/api/db/settings", { credentials: "include" }),
            fetch("/api/db/transactions", { credentials: "include" }),
            fetch("/api/db/excluded", { credentials: "include" }),
            fetch("/api/db/included", { credentials: "include" }),
          ]);

          if (settingsRes.ok) {
            const dbSettings = await settingsRes.json();
            const settings: Partial<UserSettings> = {};
            // Note: monoToken is NOT returned from settings API for security
            // Token status is checked via /api/db/mono-token instead
            if (dbSettings.accountId) settings.accountId = dbSettings.accountId;
            if (dbSettings.accountBalance) settings.accountBalance = Number(dbSettings.accountBalance);
            if (dbSettings.accountCurrency) settings.accountCurrency = Number(dbSettings.accountCurrency);
            // Legacy support for monthlyBudget
            if (dbSettings.monthlyBudget) settings.monthlyBudget = Number(dbSettings.monthlyBudget);
            if (Object.keys(settings).length > 0) {
              set((state) => ({ settings: { ...state.settings, ...settings } }));
            }
          }

          if (transactionsRes.ok) {
            const transactions = await transactionsRes.json();
            if (Array.isArray(transactions) && transactions.length > 0) {
              set({ transactions });
            }
          }

          if (excludedRes.ok) {
            const excludedIds = await excludedRes.json();
            if (Array.isArray(excludedIds)) {
              set({ excludedTransactionIds: excludedIds });
            }
          }

          if (includedRes.ok) {
            const includedIds = await includedRes.json();
            if (Array.isArray(includedIds)) {
              set({ includedTransactionIds: includedIds });
            }
          }

          set({ dbInitialized: true });
        } catch (error) {
          console.error("Failed to init from DB:", error);
          set({ dbInitialized: true });
        }
      },

      syncToDb: async () => {
        const state = get();
        try {
          // Sync settings (excluding monoToken which is managed via separate API)
          await Promise.all(
            Object.entries(state.settings)
              .filter(([key]) => key !== "monoToken")
              .map(([key, value]) =>
                value !== undefined
                  ? fetch("/api/db/settings", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ key, value: String(value) }),
                      credentials: "include",
                    })
                  : Promise.resolve()
              )
          );

          // Sync transactions
          if (state.transactions.length > 0) {
            await fetch("/api/db/transactions", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ transactions: state.transactions }),
              credentials: "include",
            });
          }
        } catch (error) {
          console.error("Failed to sync to DB:", error);
        }
      },
    }),
    {
      name: "burn-rate-storage",
      partialize: (state) => ({
        settings: {
          ...state.settings,
          // NEVER persist monoToken to localStorage for security
          // Token is stored encrypted in database only
          monoToken: undefined,
        },
        // excludedTransactionIds - loaded from SQLite DB only, not localStorage
        // transactions - loaded from SQLite DB only, not localStorage
        monthBudget: state.monthBudget,
        customCategories: state.customCategories,
        transactionCategories: state.transactionCategories,
        transactionComments: state.transactionComments,
        cachedAccounts: state.cachedAccounts, // Cache accounts to avoid rate limiting
      }),
    }
  )
);
