import { create } from "zustand";
import { persist } from "zustand/middleware";
import { UserSettings, MonthBudget, InflationPrediction, Transaction } from "@/types";

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
  customCategories: CustomCategory[];
  transactionCategories: Record<string, string>; // transactionId -> categoryId
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
  addCustomCategory: (category: CustomCategory) => void;
  removeCustomCategory: (categoryId: string) => void;
  setTransactionCategory: (transactionId: string, categoryId: string | null) => void;
  setLoading: (loading: boolean) => void;
  setHistoricalLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
  initFromDb: () => Promise<void>;
  syncToDb: () => Promise<void>;
}

const initialSettings: UserSettings = {
  monthlyBudget: 1500000,
  accountId: "0",
};

export const useBudgetStore = create<BudgetState>()(
  persist(
    (set, get) => ({
      settings: initialSettings,
      monthBudget: null,
      inflationPrediction: null,
      transactions: [],
      excludedTransactionIds: [],
      customCategories: [],
      transactionCategories: {},
      isLoading: false,
      isHistoricalLoading: false,
      error: null,
      dbInitialized: false,

      setSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
        // Sync to DB
        const state = get();
        const settings = { ...state.settings, ...newSettings };
        Object.entries(settings).forEach(([key, value]) => {
          if (value !== undefined) {
            fetch("/api/db/settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key, value: String(value) }),
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
          customCategories: [],
          transactionCategories: {},
          isLoading: false,
          isHistoricalLoading: false,
          error: null,
          dbInitialized: false,
        }),

      initFromDb: async () => {
        try {
          const [settingsRes, transactionsRes, excludedRes] = await Promise.all([
            fetch("/api/db/settings", { credentials: "include" }),
            fetch("/api/db/transactions", { credentials: "include" }),
            fetch("/api/db/excluded", { credentials: "include" }),
          ]);

          if (settingsRes.ok) {
            const dbSettings = await settingsRes.json();
            const settings: Partial<UserSettings> = {};
            if (dbSettings.monoToken) settings.monoToken = dbSettings.monoToken;
            if (dbSettings.monthlyBudget) settings.monthlyBudget = Number(dbSettings.monthlyBudget);
            if (dbSettings.accountId) settings.accountId = dbSettings.accountId;
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

          set({ dbInitialized: true });
        } catch (error) {
          console.error("Failed to init from DB:", error);
          set({ dbInitialized: true });
        }
      },

      syncToDb: async () => {
        const state = get();
        try {
          // Sync settings
          await Promise.all(
            Object.entries(state.settings).map(([key, value]) =>
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
        settings: state.settings,
        // excludedTransactionIds - loaded from SQLite DB only, not localStorage
        // transactions - loaded from SQLite DB only, not localStorage
        monthBudget: state.monthBudget,
        customCategories: state.customCategories,
        transactionCategories: state.transactionCategories,
      }),
    }
  )
);
