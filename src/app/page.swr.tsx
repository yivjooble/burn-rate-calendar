"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSettings, useBudget, useCategories, updateSettingsOptimistic, recalculateBudget } from "@/lib/hooks/useBudget";
import { BudgetCalendar } from "@/components/budget-calendar";
import { BudgetSummary } from "@/components/budget-summary";
import { SpendingChart } from "@/components/spending-chart";
import { SettingsPanel } from "@/components/settings-panel";
import { TwoFactorSettings } from "@/components/two-factor-settings";
import { DayDetailModal } from "@/components/day-detail-modal";
import { CategoriesPage } from "@/components/categories-page";
import { distributeBudget } from "@/lib/budget-ai";
import { getFinancialMonthBoundaries, getFinancialMonthStart } from "@/lib/monobank";
import { refreshTodayTransactions, incrementalSync, getAllStoredTransactions, isHistoricalDataAvailable } from "@/lib/mono-sync";
import { DayBudget, UserSettings, convertToUAH } from "@/types";
import { Flame, Settings, ChartLine, Calendar, RefreshCw, AlertCircle, Tags, LogOut, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSession, signOut } from "next-auth/react";
import useSWR from "swr";

type TabType = "calendar" | "prediction" | "categories" | "settings";

const fetcher = async (url: string) => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
};

// =============================================================================
// REFACTORED: Home Page with SWR Hooks
// This shows the migration from Zustand persist to SWR real-time updates
// =============================================================================

export default function HomeRefactored() {
  const { data: session } = useSession();
  
  // SWR hooks instead of Zustand store
  const { settings, mutate: mutateSettings } = useSettings();
  const { budget, mutate: mutateBudget } = useBudget();
  const { categories, mutate: mutateCategories } = useCategories();
  
  // Legacy state for gradual migration
  const [activeTab, setActiveTab] = useState<TabType>("calendar");
  const [selectedDay, setSelectedDay] = useState<DayBudget | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasHistoricalData, setHasHistoricalData] = useState(false);
  const [hasMonoToken, setHasMonoToken] = useState(false);
  const [selectedFinancialMonth, setSelectedFinancialMonth] = useState<Date>(() => new Date());
  const [displayedBudget, setDisplayedBudget] = useState<typeof budget>(null);
  const [isMonthLoading, setIsMonthLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Background sync ref
  const backgroundSyncRef = useRef<NodeJS.Timeout | null>(null);

  // Check Monobank token
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

  // Initialize hydration
  useEffect(() => {
    const savedTab = localStorage.getItem("burn-rate-active-tab") as TabType | null;
    if (savedTab && ["calendar", "prediction", "categories", "settings"].includes(savedTab)) {
      setActiveTab(savedTab);
    }
    setIsHydrated(true);
  }, []);

  // Save active tab
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem("burn-rate-active-tab", activeTab);
    }
  }, [activeTab, isHydrated]);

  // =============================================================================
  // Optimistic Update Example
  // =============================================================================

  /**
   * Update settings with optimistic UI update
   */
  const handleUpdateSettings = useCallback(async (newSettings: Partial<UserSettings>) => {
    setIsLoading(true);
    try {
      await updateSettingsOptimistic(newSettings, mutateSettings);
      // Budget will auto-refresh via SWR (every 10 seconds)
      // or we can trigger it manually:
      await recalculateBudget();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to update settings");
    } finally {
      setIsLoading(false);
    }
  }, [mutateSettings]);

  // =============================================================================
  // Background Sync with SWR mutate
  // =============================================================================

  /**
   * Perform background sync and refresh SWR data
   */
  const handleBackgroundSync = useCallback(async () => {
    if (!settings?.accountId) return;

    try {
      await refreshTodayTransactions([settings.accountId]);
      await incrementalSync([settings.accountId]);
      
      // Trigger SWR revalidation for all data
      await Promise.all([
        mutateSettings(),
        mutateBudget(),
      ]);
      
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Background sync failed:", error);
    }
  }, [settings?.accountId, mutateSettings, mutateBudget]);

  // Background sync every 5 minutes
  useEffect(() => {
    if (!isHydrated || !hasMonoToken || !settings?.accountId) return;

    backgroundSyncRef.current = setInterval(() => {
      handleBackgroundSync();
    }, 5 * 60 * 1000);

    return () => {
      if (backgroundSyncRef.current) {
        clearInterval(backgroundSyncRef.current);
      }
    };
  }, [isHydrated, hasMonoToken, settings?.accountId, handleBackgroundSync]);

  // =============================================================================
  // Loading States from SWR
  // =============================================================================

  const isBudgetLoading = !budget && !error;
  const isSettingsLoading = !settings && !error;

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Завантаження...</div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Header */}
      <header className="flex-shrink-0 border-b bg-background/95 backdrop-blur h-14">
        <div className="h-full max-w-4xl mx-auto px-4 flex items-center justify-between">
          <button onClick={() => setActiveTab("calendar")} className="flex items-center gap-2">
            <Flame className="w-6 h-6 text-orange-500" />
            <span className="font-semibold">Burn Rate Calendar</span>
          </button>
          <div className="flex items-center gap-1">
            <Button
              variant={activeTab === "calendar" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("calendar")}
              disabled={isLoading}
            >
              <Calendar className="w-4 h-4 mr-1" />
              Календар
            </Button>
            <Button
              variant={activeTab === "categories" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("categories")}
              disabled={isLoading}
            >
              <Tags className="w-4 h-4 mr-1" />
              Категорії
            </Button>
            <Button
              variant={activeTab === "prediction" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("prediction")}
              disabled={isLoading}
            >
              <ChartLine className="w-4 h-4 mr-1" />
              Статистика
            </Button>
            <Button
              variant={activeTab === "settings" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("settings")}
              disabled={isLoading}
            >
              <Settings className="w-4 h-4 mr-1" />
              Налаштування
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === "calendar" && (
            <div className="space-y-4">
              {/* Top bar with SWR-powered auto-refresh status */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {lastRefresh && (
                    <span>Оновлено: {lastRefresh.toLocaleTimeString("uk-UA")} • </span>
                  )}
                  {hasMonoToken ? (
                    <span>
                      Monobank {isBudgetLoading ? "(завантаження...)" : ""}
                    </span>
                  ) : (
                    <span className="text-orange-500">Токен не налаштовано</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBackgroundSync}
                    disabled={isLoading || !hasMonoToken}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                    {isLoading ? "Завантаження..." : "Оновити"}
                  </Button>
                </div>
              </div>

              {/* SWR-powered budget display */}
              {budget && (
                <>
                  <BudgetSummary budget={budget} />
                  <BudgetCalendar
                    dailyLimits={budget.dailyLimits}
                    onDayClick={setSelectedDay}
                    selectedMonth={selectedFinancialMonth}
                    onMonthChange={(month) => setSelectedFinancialMonth(month)}
                  />
                </>
              )}

              {/* Loading state from SWR */}
              {isBudgetLoading && (
                <div className="h-64 rounded-lg bg-muted/50 animate-pulse flex items-center justify-center">
                  <span className="text-muted-foreground">Завантаження бюджету...</span>
                </div>
              )}
            </div>
          )}

          {activeTab === "prediction" && (
            <SpendingChart onRefresh={handleBackgroundSync} isLoading={isLoading} />
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

      {selectedDay && (
        <DayDetailModal day={selectedDay} onClose={() => setSelectedDay(null)} />
      )}
    </div>
  );
}
