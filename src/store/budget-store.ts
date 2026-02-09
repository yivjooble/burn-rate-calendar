import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { UserSettings, MonthBudget, InflationPrediction, Transaction, MonoAccount, CustomCategory } from "@/types";

// Hybrid store that works with both localStorage and SWR
// During migration, this store holds client-only state
// while SWR handles server-synced data

export interface CustomCategoryStore {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface BudgetState {
  // Server-synced data (will be migrated to SWR)
  settings: UserSettings;
  transactions: Transaction[];
  excludedTransactionIds: string[];
  includedTransactionIds: string[];
  
  // Client-only state (remains in localStorage)
  monthBudget: MonthBudget | null;
  inflationPrediction: InflationPrediction | null;
  customCategories: CustomCategoryStore[];
  transactionCategories: Record<string, string>; // transactionId -> categoryId
  transactionComments: Record<string, string>; // transactionId -> comment
  cachedAccounts: MonoAccount[];
  
  // UI state
  isLoading: boolean;
  isHistoricalLoading: boolean;
  error: string | null;
  dbInitialized: boolean;

  // Actions
  setSettings: (settings: Partial<UserSettings>) => void;
  setMonthBudget: (budget: MonthBudget) => void;
  setInflationPrediction: (prediction: InflationPrediction) => void;
  setTransactions: (transactions: Transaction[]) => void;
  excludeTransaction: (transactionId: string) => void;
  includeTransaction: (transactionId: string) => void;
  includeAutoExcluded: (transactionId: string) => void;
  removeIncludeOverride: (transactionId: string) => void;
  addCustomCategory: (category: CustomCategoryStore) => void;
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
  
  // SWR integration methods
  setBudgetFromSWR: (budget: MonthBudget) => void;
  updateSettingsFromSWR: (settings: UserSettings) => void;
  updateCategoriesFromSWR: (categories: CustomCategory[]) => void;
}

const initialSettings: UserSettings = {
  accountId: "",
  accountBalance: 0,
  accountCurrency: 980, // UAH by default
};

// Legacy storage interface for migration
interface LegacyStorage {
  settings: UserSettings;
  monthBudget: MonthBudget | null;
  customCategories: CustomCategoryStore[];
  transactionCategories: Record<string, string>;
  transactionComments: Record<string, string>;
  cachedAccounts: MonoAccount[];
}

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
        // Sync to DB (excluding monoToken)
        Object.entries(newSettings)
          .filter(([key]) => key !== "monoToken")
          .forEach(([key, value]) => {
            if (value !== undefined) {
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

      // SWR integration: update budget from SWR cache
      setBudgetFromSWR: (budget) => set({ monthBudget: budget }),

      // SWR integration: update settings from SWR cache
      updateSettingsFromSWR: (settings) => set({ settings }),

      // SWR integration: update categories from SWR cache
      updateCategoriesFromSWR: (categories) => {
        const storeCategories = categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          icon: cat.icon || "",
          color: cat.color || "#000000",
        }));
        set({ customCategories: storeCategories });
      },

      setInflationPrediction: (prediction) =>
        set({ inflationPrediction: prediction }),

      setTransactions: (transactions) => {
        set({ transactions });
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
            if (dbSettings.accountId) settings.accountId = dbSettings.accountId;
            if (dbSettings.accountBalance) settings.accountBalance = Number(dbSettings.accountBalance);
            if (dbSettings.accountCurrency) settings.accountCurrency = Number(dbSettings.accountCurrency);
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
      storage: createJSONStorage<LegacyStorage>(() => localStorage),
      partialize: (state) => ({
        settings: {
          ...state.settings,
          monoToken: undefined, // Never persist monoToken
        },
        monthBudget: state.monthBudget,
        customCategories: state.customCategories,
        transactionCategories: state.transactionCategories,
        transactionComments: state.transactionComments,
        cachedAccounts: state.cachedAccounts,
      }),
    }
  )
);
