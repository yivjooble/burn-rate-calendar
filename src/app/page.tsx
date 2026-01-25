"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useBudgetStore } from "@/store/budget-store";
import { BudgetCalendar } from "@/components/budget-calendar";
import { BudgetSummary } from "@/components/budget-summary";
import { SpendingChart } from "@/components/spending-chart";
import { SettingsPanel } from "@/components/settings-panel";
import { TwoFactorSettings } from "@/components/two-factor-settings";
import { DayDetailModal } from "@/components/day-detail-modal";
import { CategoriesPage } from "@/components/categories-page";
import { distributeBudget } from "@/lib/budget-ai";
import { getFinancialMonthBoundaries, getFinancialMonthStart, getFinancialMonthEnd } from "@/lib/monobank";
import {
  calculateHistoricalMonthSummary,
  fetchStoredDailyBudgets,
  isCurrentFinancialMonth,
} from "@/lib/historical-budget";
import {
  refreshTodayTransactions,
  getAllStoredTransactions,
  isHistoricalDataAvailable,
  getLastSync,
  fetchCurrencyRates,
} from "@/lib/mono-sync";
import { DayBudget, CurrencyRate, convertToUAH } from "@/types";
import { Flame, Settings, ChartLine, Calendar, RefreshCw, AlertCircle, Tags, LogOut, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSession, signOut } from "next-auth/react";

type TabType = "calendar" | "prediction" | "categories" | "settings";

export default function Home() {
  const { data: session } = useSession();
  const {
    settings,
    setSettings,
    setMonthBudget,
    monthBudget,
    transactions,
    setTransactions,
    excludedTransactionIds,
    isLoading,
    isHistoricalLoading,
    setLoading,
    error,
    setError,
  } = useBudgetStore();
  const [activeTab, setActiveTab] = useState<TabType>("calendar");
  const [selectedDay, setSelectedDay] = useState<DayBudget | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [syncProgress, setSyncProgress] = useState<string | null>(null);
  const [hasHistoricalData, setHasHistoricalData] = useState(false);
  const [currencyRates, setCurrencyRates] = useState<CurrencyRate[]>([]);
  const [hasMonoToken, setHasMonoToken] = useState(false);
  const [selectedFinancialMonth, setSelectedFinancialMonth] = useState<Date>(() => new Date());
  const [displayedBudget, setDisplayedBudget] = useState<typeof monthBudget>(null);
  const backgroundSyncRef = useRef<NodeJS.Timeout | null>(null);

  const { initFromDb, dbInitialized } = useBudgetStore();

  // Check if Monobank token exists on server
  useEffect(() => {
    const checkToken = async () => {
      try {
        const response = await fetch("/api/db/mono-token");
        const data = await response.json();
        setHasMonoToken(data.hasToken);
      } catch (error) {
        console.error("Failed to check token status:", error);
      }
    };
    checkToken();
  }, []);

  // Load active tab from localStorage and init from DB on mount
  useEffect(() => {
    const savedTab = localStorage.getItem("burn-rate-active-tab") as TabType | null;
    if (savedTab && ["calendar", "prediction", "categories", "settings"].includes(savedTab)) {
      setActiveTab(savedTab);
    }
    // Initialize from SQLite DB
    initFromDb();
    setIsHydrated(true);
  }, [initFromDb]);

  // Save active tab to localStorage when it changes
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem("burn-rate-active-tab", activeTab);
    }
  }, [activeTab, isHydrated]);

  // Refresh account balance from Monobank API
  const refreshAccountBalance = useCallback(async () => {
    if (!hasMonoToken || !settings.accountId) return;

    try {
      const response = await fetch("/api/mono/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: "/personal/client-info" }),
      });
      if (response.ok) {
        const data = await response.json();
        const account = data.accounts?.find((a: { id: string }) => a.id === settings.accountId);
        if (account) {
          setSettings({
            accountBalance: account.balance,
            accountCurrency: account.currencyCode,
          });
        }
      }
    } catch (err) {
      console.error("Failed to refresh account balance:", err);
    }
  }, [hasMonoToken, settings.accountId, setSettings]);

  // Save daily budgets to database (all days, but preserve historical data)
  const saveDailyBudgets = useCallback(async (budget: any) => {
    if (!session?.user?.id) return;

    try {
      // Save ALL days in the financial month
      // The API will handle preserving historical data (won't overwrite past days)
      const budgetsToSave = budget.dailyLimits.map((dayBudget: DayBudget) => ({
        date: dayBudget.date.toISOString(),
        limit: dayBudget.limit,
        spent: dayBudget.spent,
        balance: dayBudget.limit // Store the limit as balance for historical reference
      }));

      if (budgetsToSave.length > 0) {
        await fetch("/api/db/daily-budgets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            budgets: budgetsToSave,
            preserveHistorical: true, // Don't overwrite past days that already have data
          }),
          credentials: "include",
        });
      }
    } catch {
      // Silently fail - saving budgets is not critical
    }
  }, [session?.user?.id]);

  // Load stored transactions and calculate budget
  const loadFromStorage = useCallback(async () => {
    try {
      const rates = await fetchCurrencyRates();
      setCurrencyRates(rates);

      const storedTransactions = await getAllStoredTransactions();
      if (storedTransactions.length > 0) {
        setTransactions(storedTransactions);

        // Filter to current financial month for budget calculation
        const now = new Date();
        const financialDayStart = settings.financialMonthStart || 1;
        const { from: currentFrom, to: currentTo } = getFinancialMonthBoundaries(now, financialDayStart);
        const currentMonthTx = storedTransactions.filter(
          tx => tx.time >= currentFrom && tx.time <= currentTo
        );

        // Convert to UAH for budget
        const transactionsInUAH = currentMonthTx.map(tx => ({
          ...tx,
          amount: Math.round(convertToUAH(tx.amount, tx.currencyCode, rates)),
        }));

        // Use account balance as the budget (convert to UAH if needed)
        const budgetAmount = settings.accountBalance
          ? Math.round(convertToUAH(settings.accountBalance, settings.accountCurrency, rates))
          : 0;

        const budget = await distributeBudget(
          budgetAmount,
          new Date(),
          storedTransactions, // Use all transactions for pattern analysis
          transactionsInUAH,
          excludedTransactionIds,
          budgetAmount, // currentBalance = card balance in UAH
          session?.user?.id,
          settings.useAIBudget ?? true, // Use AI setting from user preferences
          financialDayStart
        );
        setMonthBudget(budget);

        // Save daily budgets to preserve historical limits
        await saveDailyBudgets(budget);

        const lastSync = await getLastSync();
        if (lastSync) {
          setLastRefresh(new Date(lastSync));
        }
      }
    } catch {
      // Silently fail - loading from storage is not critical
    }
  }, [settings.accountBalance, settings.accountCurrency, settings.financialMonthStart, excludedTransactionIds, setTransactions, setMonthBudget, saveDailyBudgets, session?.user?.id]);

  // Refresh only today's transactions and account balance (quick update)
  const refreshToday = useCallback(async () => {
    if (!hasMonoToken) {
      setError("Збережіть токен Monobank в налаштуваннях");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Refresh account balance first
      await refreshAccountBalance();

      // Then refresh today's transactions
      if (settings.accountId) {
        await refreshTodayTransactions([settings.accountId]);
      }
      await loadFromStorage();
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка оновлення");
    } finally {
      setLoading(false);
    }
  }, [hasMonoToken, settings.accountId, refreshAccountBalance, loadFromStorage, setLoading, setError]);

  // Refresh today's transactions only (no full historical sync)
  const fetchMonoData = useCallback(async () => {
    if (!hasMonoToken) {
      setError("Збережіть токен Monobank в налаштуваннях");
      return;
    }

    // Always just refresh today's transactions
    // Historical data should be loaded via Settings panel
    await refreshToday();
  }, [
    hasMonoToken,
    refreshToday,
    setError,
  ]);

  // Check for historical data and load from storage on mount
  useEffect(() => {
    if (!isHydrated) return;

    const initData = async () => {
      const hasData = await isHistoricalDataAvailable();
      setHasHistoricalData(hasData);
      
      if (hasData) {
        // Load from SQLite DB
        await loadFromStorage();
      }
      // Don't auto-sync on page refresh - user should manually trigger historical data load
    };

    initData();
  }, [isHydrated, loadFromStorage]);

  // Background sync every 5 minutes - refresh balance and transactions
  useEffect(() => {
    if (!isHydrated || !hasMonoToken || !hasHistoricalData || !settings.accountId) return;

    const startBackgroundSync = () => {
      if (backgroundSyncRef.current) {
        clearInterval(backgroundSyncRef.current);
      }

      backgroundSyncRef.current = setInterval(async () => {
        try {
          // Refresh account balance
          await refreshAccountBalance();
          // Refresh today's transactions
          await refreshTodayTransactions([settings.accountId]);
          await loadFromStorage();
          setLastRefresh(new Date());
        } catch {
          // Ignore background sync errors
        }
      }, 5 * 60 * 1000); // 5 minutes
    };

    startBackgroundSync();

    return () => {
      if (backgroundSyncRef.current) {
        clearInterval(backgroundSyncRef.current);
      }
    };
  }, [isHydrated, hasMonoToken, settings.accountId, hasHistoricalData, refreshAccountBalance, loadFromStorage]);

  useEffect(() => {
    if (!isHydrated) return;

    // Always create empty budget structure so calendar is visible
    const createInitialBudget = async () => {
      if (!monthBudget) {
        const budgetAmount = settings.accountBalance || 0;
        const financialDayStart = settings.financialMonthStart || 1;
        const budget = await distributeBudget(budgetAmount, new Date(), transactions, [], excludedTransactionIds, budgetAmount, session?.user?.id, settings.useAIBudget ?? true, financialDayStart);
        setMonthBudget(budget);

        // Save daily budgets to preserve historical limits
        await saveDailyBudgets(budget);
      }
    };

    createInitialBudget();
  }, [isHydrated, settings.accountBalance, settings.financialMonthStart, monthBudget, excludedTransactionIds, setMonthBudget, saveDailyBudgets, session?.user?.id]);

  // Handle month change from calendar navigation
  const handleMonthChange = useCallback(async (month: Date) => {
    setSelectedFinancialMonth(month);

    const financialDayStart = settings.financialMonthStart || 1;
    const isCurrent = isCurrentFinancialMonth(month, financialDayStart);

    if (isCurrent) {
      // For current month, use the live calculated budget
      setDisplayedBudget(monthBudget);
    } else {
      // For historical months, calculate from stored data
      const monthStart = getFinancialMonthStart(month, financialDayStart);
      const monthEnd = getFinancialMonthEnd(month, financialDayStart);

      // Fetch stored daily budgets for this month
      const storedBudgets = await fetchStoredDailyBudgets(monthStart, monthEnd);

      // Calculate historical summary
      const historicalBudget = calculateHistoricalMonthSummary({
        transactions,
        excludedTransactionIds,
        monthStart,
        monthEnd,
        storedBudgets,
      });

      setDisplayedBudget(historicalBudget);
    }
  }, [settings.financialMonthStart, monthBudget, transactions, excludedTransactionIds]);

  // Initialize selected month to current financial month when settings load
  useEffect(() => {
    if (isHydrated && settings.financialMonthStart) {
      const currentFinancialMonth = getFinancialMonthStart(new Date(), settings.financialMonthStart);
      setSelectedFinancialMonth(currentFinancialMonth);
    }
  }, [isHydrated, settings.financialMonthStart]);

  // Sync displayedBudget with monthBudget when viewing current month
  useEffect(() => {
    const financialDayStart = settings.financialMonthStart || 1;
    if (isCurrentFinancialMonth(selectedFinancialMonth, financialDayStart) && monthBudget) {
      setDisplayedBudget(monthBudget);
    }
  }, [monthBudget, selectedFinancialMonth, settings.financialMonthStart]);

  // Recalculate budget when excluded transactions or balance change
  const recalculateBudget = useCallback(async () => {
    if (transactions.length > 0) {
      // Filter to current financial month for budget calculation
      const now = new Date();
      const financialDayStart = settings.financialMonthStart || 1;
      const { from: currentFrom, to: currentTo } = getFinancialMonthBoundaries(now, financialDayStart);
      const currentMonthTx = transactions.filter(
        tx => tx.time >= currentFrom && tx.time <= currentTo
      );

      // Convert balance to UAH if needed
      const rates = currencyRates.length > 0 ? currencyRates : await fetchCurrencyRates();
      const budgetAmount = settings.accountBalance
        ? Math.round(convertToUAH(settings.accountBalance, settings.accountCurrency, rates))
        : 0;

      const budget = await distributeBudget(
        budgetAmount,
        new Date(),
        transactions, // Use all transactions for pattern analysis
        currentMonthTx,
        excludedTransactionIds,
        budgetAmount, // currentBalance = card balance in UAH
        session?.user?.id,
        settings.useAIBudget ?? true, // Use AI setting from user preferences
        financialDayStart
      );
      setMonthBudget(budget);

      // Save daily budgets to preserve historical limits
      await saveDailyBudgets(budget);
    }
  }, [transactions, settings.accountBalance, settings.accountCurrency, settings.financialMonthStart, currencyRates, excludedTransactionIds, setMonthBudget]);

  useEffect(() => {
    if (isHydrated && transactions.length > 0) {
      recalculateBudget();
    }
  }, [excludedTransactionIds, isHydrated, transactions.length, recalculateBudget]);

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Завантаження...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Header - Desktop only */}
      <header className="flex-shrink-0 border-b bg-background/95 backdrop-blur h-14 hidden md:block">
        <div className="h-full max-w-4xl mx-auto px-4 flex items-center justify-between">
          <button
            onClick={() => setActiveTab("calendar")}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
          >
            <Flame className="w-6 h-6 text-orange-500" />
            <span className="font-semibold">Burn Rate Calendar</span>
          </button>
          <div className="flex items-center gap-1">
            <Button
              variant={activeTab === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("calendar")}
              disabled={isLoading || isHistoricalLoading}
            >
              <Calendar className="w-4 h-4 mr-1" />
              Календар
            </Button>
            <Button
              variant={activeTab === "categories" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("categories")}
              disabled={isLoading || isHistoricalLoading}
            >
              <Tags className="w-4 h-4 mr-1" />
              Категорії
            </Button>
            <Button
              variant={activeTab === "prediction" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("prediction")}
              disabled={isLoading || isHistoricalLoading}
            >
              <ChartLine className="w-4 h-4 mr-1" />
              Статистика
            </Button>
            <Button
              variant={activeTab === "settings" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("settings")}
              disabled={isLoading || isHistoricalLoading}
            >
              <Settings className="w-4 h-4 mr-1" />
              Налаштування
            </Button>
            <Separator orientation="vertical" className="h-6 mx-2" />
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                {session?.user?.name || session?.user?.email?.split("@")[0]}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/login" })}
                title={session?.user?.email || "Вийти"}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="flex-shrink-0 border-b bg-background/95 backdrop-blur h-12 md:hidden">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <span className="font-semibold text-sm">Burn Rate</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground truncate max-w-[100px]">
              {session?.user?.name || session?.user?.email?.split("@")[0]}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === "calendar" && (
            <div className="space-y-4">
              {/* Top bar */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {lastRefresh && (
                    <span>Оновлено: {lastRefresh.toLocaleTimeString("uk-UA")} • </span>
                  )}
                  {hasMonoToken ? (
                    <span>
                      Monobank грудень 2025
                      {settings.selectedAccountCurrencies && settings.selectedAccountCurrencies.length > 0 && (
                        <span className="ml-1 text-xs">
                          ({[...new Set(settings.selectedAccountCurrencies)].map(code =>
                            code === 980 ? "UAH" : code === 840 ? "USD" : code === 978 ? "EUR" : code
                          ).join(", ")})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-orange-500">Токен не налаштовано</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <HelpCircle className="w-4 h-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Про Burn Rate Calendar</DialogTitle>
                        <DialogDescription>
                          Додаток для контролю витрат на основі даних Monobank
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 text-sm">
                        <div>
                          <h4 className="font-medium mb-1">Як розраховується бюджет?</h4>
                          <p className="text-muted-foreground">
                            Бюджет автоматично розраховується на основі поточного балансу вашої картки.
                            Денний ліміт = залишок на картці / кількість днів до кінця фінансового місяця.
                            Це забезпечує рівномірний розподіл коштів на весь період.
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-1">Синхронізація з Monobank</h4>
                          <p className="text-muted-foreground">
                            Дані оновлюються автоматично кожні 5 хвилин. Натисніть кнопку &quot;Оновити&quot;
                            для ручного оновлення. Історичні дані завантажуються у налаштуваннях.
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-1">Фінансовий місяць</h4>
                          <p className="text-muted-foreground">
                            Ви можете налаштувати день початку фінансового місяця у налаштуваннях
                            (наприклад, з 5-го числа, якщо зарплата приходить 5-го).
                          </p>
                        </div>
                        <div>
                          <h4 className="font-medium mb-1">Виключення транзакцій</h4>
                          <p className="text-muted-foreground">
                            Натисніть на день у календарі, щоб переглянути транзакції.
                            Ви можете виключити певні транзакції з розрахунку бюджету
                            (наприклад, переказ на іншу картку).
                          </p>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchMonoData()}
                    disabled={isLoading || !hasMonoToken}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                    {isLoading ? (syncProgress || "Завантаження...") : "Оновити"}
                  </Button>
                </div>
              </div>

              {(displayedBudget || monthBudget) && (
                <>
                  <BudgetSummary budget={displayedBudget || monthBudget!} />
                  <BudgetCalendar
                    dailyLimits={(displayedBudget || monthBudget!).dailyLimits}
                    onDayClick={setSelectedDay}
                    selectedMonth={selectedFinancialMonth}
                    onMonthChange={handleMonthChange}
                  />
                </>
              )}
            </div>
          )}

          {activeTab === "prediction" && (
            <SpendingChart onRefresh={fetchMonoData} isLoading={isLoading} />
          )}

          {activeTab === "categories" && (
            <CategoriesPage />
          )}

          {activeTab === "settings" && (
            <div className="space-y-4 pb-20 md:pb-4">
              <SettingsPanel onSave={() => setActiveTab("calendar")} />
              <TwoFactorSettings />
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="flex-shrink-0 border-t bg-background/95 backdrop-blur md:hidden safe-area-bottom">
        <div className="grid grid-cols-4 h-16">
          <button
            onClick={() => setActiveTab("calendar")}
            disabled={isLoading || isHistoricalLoading}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "calendar"
                ? "text-foreground"
                : "text-muted-foreground"
            }`}
          >
            <Calendar className="w-5 h-5" />
            <span className="text-[10px]">Календар</span>
          </button>
          <button
            onClick={() => setActiveTab("categories")}
            disabled={isLoading || isHistoricalLoading}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "categories"
                ? "text-foreground"
                : "text-muted-foreground"
            }`}
          >
            <Tags className="w-5 h-5" />
            <span className="text-[10px]">Категорії</span>
          </button>
          <button
            onClick={() => setActiveTab("prediction")}
            disabled={isLoading || isHistoricalLoading}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "prediction"
                ? "text-foreground"
                : "text-muted-foreground"
            }`}
          >
            <ChartLine className="w-5 h-5" />
            <span className="text-[10px]">Статистика</span>
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            disabled={isLoading || isHistoricalLoading}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "settings"
                ? "text-foreground"
                : "text-muted-foreground"
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[10px]">Налаштув.</span>
          </button>
        </div>
      </nav>

      {selectedDay && (
        <DayDetailModal day={selectedDay} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  );
}
