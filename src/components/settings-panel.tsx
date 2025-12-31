"use client";

import { useState, useEffect } from "react";
import { useBudgetStore } from "@/store/budget-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings, Eye, EyeOff, Save, RefreshCw, CreditCard, Download, CalendarIcon } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, subMonths } from "date-fns";
import { uk } from "date-fns/locale";
import { loadHistoricalData, isHistoricalDataAvailable, getAllStoredTransactions, getLoadedPeriod } from "@/lib/mono-sync";

interface SettingsPanelProps {
  onSave?: () => void;
}

const CURRENCY_NAMES: Record<number, string> = {
  980: "UAH",
  840: "USD",
  978: "EUR",
  826: "GBP",
  985: "PLN",
};

const CARD_TYPE_NAMES: Record<string, string> = {
  black: "Чорна",
  white: "Біла",
  platinum: "Platinum",
  iron: "Iron",
  yellow: "Yellow",
  fop: "ФОП",
  eAid: "єПідтримка",
};

export function SettingsPanel({ onSave }: SettingsPanelProps) {
  const { settings, setSettings, setTransactions, isHistoricalLoading, setHistoricalLoading, cachedAccounts, setCachedAccounts } = useBudgetStore();
  const [showToken, setShowToken] = useState(false);
  const [localToken, setLocalToken] = useState(settings.monoToken || "");
  const [localBudget, setLocalBudget] = useState(
    (settings.monthlyBudget / 100).toString()
  );
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(
    settings.selectedAccountIds || []
  );
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  
  // Historical data loading state
  const [historicalDateRange, setHistoricalDateRange] = useState<{ from: Date; to: Date }>(() => ({
    from: subMonths(new Date(), 3),
    to: new Date(),
  }));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [historicalProgress, setHistoricalProgress] = useState<string | null>(null);
  const [historicalError, setHistoricalError] = useState<string | null>(null);
  const [hasHistoricalData, setHasHistoricalData] = useState(false);
  const [loadedPeriod, setLoadedPeriod] = useState<{ from: number | null; to: number | null }>({ from: null, to: null });
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  // Check if historical data exists on mount and get the loaded period
  useEffect(() => {
    const checkHistorical = async () => {
      const hasData = await isHistoricalDataAvailable();
      setHasHistoricalData(hasData);
      if (hasData) {
        const period = await getLoadedPeriod();
        setLoadedPeriod(period);
      }
    };
    checkHistorical();
  }, []);

  // Prevent page refresh during historical loading
  useEffect(() => {
    if (!isHistoricalLoading) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Завантаження історичних даних ще не завершено. Ви впевнені, що хочете покинути сторінку?";
      return e.returnValue;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isHistoricalLoading]);

  const handleCancelLoading = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setHistoricalLoading(false);
    setHistoricalProgress(null);
    setHistoricalError("Завантаження скасовано");
  };

  const handleLoadHistorical = async () => {
    if (!localToken) {
      setHistoricalError("Введіть токен Monobank");
      return;
    }
    if (selectedAccounts.length === 0) {
      setHistoricalError("Оберіть хоча б одну картку");
      return;
    }

    const controller = new AbortController();
    setAbortController(controller);
    setHistoricalLoading(true);
    setHistoricalError(null);
    setHistoricalProgress("Початок завантаження...");

    try {
      await loadHistoricalData(
        localToken,
        selectedAccounts,
        (progress) => {
          if (controller.signal.aborted) {
            throw new Error("ABORTED");
          }
          setHistoricalProgress(progress.message);
        },
        historicalDateRange
      );
      
      // Reload transactions into store
      const allTransactions = await getAllStoredTransactions();
      setTransactions(allTransactions);
      setHasHistoricalData(true);
      // Update loaded period
      setLoadedPeriod({
        from: Math.floor(historicalDateRange.from.getTime() / 1000),
        to: Math.floor(historicalDateRange.to.getTime() / 1000),
      });
      setHistoricalProgress(null);
    } catch (err) {
      if (err instanceof Error && err.message === "ABORTED") {
        // Already handled in handleCancelLoading
        return;
      }
      setHistoricalError(err instanceof Error ? err.message : "Помилка завантаження");
      setHistoricalProgress(null);
    } finally {
      setHistoricalLoading(false);
      setAbortController(null);
    }
  };

  const fetchAccounts = async () => {
    if (!localToken) {
      setAccountsError("Введіть токен");
      return;
    }
    setLoadingAccounts(true);
    setAccountsError(null);
    try {
      const response = await fetch("/api/mono/client-info", {
        headers: { "x-token": localToken },
      });
      if (!response.ok) {
        throw new Error("Помилка завантаження");
      }
      const data = await response.json();
      const accounts = data.accounts || [];
      setCachedAccounts(accounts);
      // Auto-select first UAH account if none selected
      if (selectedAccounts.length === 0 && accounts.length > 0) {
        const uahAccount = accounts.find((a: { currencyCode: number }) => a.currencyCode === 980);
        if (uahAccount) {
          setSelectedAccounts([uahAccount.id]);
        }
      }
    } catch (err) {
      setAccountsError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setLoadingAccounts(false);
    }
  };

  // No auto-fetch - accounts are only loaded manually via refresh button

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    );
  };

  const getAccountLabel = (account: { currencyCode: number; type: string; maskedPan?: string[] }) => {
    const currency = CURRENCY_NAMES[account.currencyCode] || account.currencyCode;
    const type = CARD_TYPE_NAMES[account.type] || account.type;
    const maskedPan = account.maskedPan?.[0] || "";
    const lastDigits = maskedPan.slice(-4);
    return `${type} ${currency}${lastDigits ? ` (*${lastDigits})` : ""}`;
  };

  const handleSave = () => {
    // Get currency codes for selected accounts
    const selectedCurrencies = selectedAccounts.map(id => {
      const acc = cachedAccounts.find(a => a.id === id);
      return acc?.currencyCode || 980;
    });
    
    setSettings({
      monoToken: localToken,
      monthlyBudget: Math.round(parseFloat(localBudget) * 100) || 1500000,
      selectedAccountIds: selectedAccounts,
      selectedAccountCurrencies: selectedCurrencies,
      accountId: selectedAccounts[0] || "0",
    });
    onSave?.();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Налаштування
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="budget">Місячний бюджет (₴)</Label>
          <Input
            id="budget"
            type="number"
            value={localBudget}
            onChange={(e) => setLocalBudget(e.target.value)}
            placeholder="15000"
          />
          <p className="text-xs text-muted-foreground">
            AI розподілить цю суму на дні місяця
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="token">Monobank Token</Label>
          <div className="relative">
            <Input
              id="token"
              type={showToken ? "text" : "password"}
              value={localToken}
              onChange={(e) => setLocalToken(e.target.value)}
              placeholder="uXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showToken ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Отримайте токен на{" "}
            <a
              href="https://api.monobank.ua/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline"
            >
              api.monobank.ua
            </a>
          </p>
        </div>

        {/* Account Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Картки для відображення</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchAccounts}
              disabled={loadingAccounts || !localToken}
            >
              <RefreshCw className={`w-3 h-3 ${loadingAccounts ? "animate-spin" : ""}`} />
            </Button>
          </div>
          {accountsError && (
            <p className="text-xs text-red-500">{accountsError}</p>
          )}
          {cachedAccounts.filter(a => !['eAid', 'madeInUkraine'].includes(a.type)).length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cachedAccounts
                .filter(account => !['eAid', 'madeInUkraine'].includes(account.type))
                .map((account) => (
                <label
                  key={account.id}
                  className="flex items-center gap-3 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedAccounts.includes(account.id)}
                    onCheckedChange={() => toggleAccount(account.id)}
                  />
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="text-sm font-medium">{getAccountLabel(account)}</div>
                    <div className="text-xs text-muted-foreground">
                      Баланс: {(account.balance / 100).toLocaleString("uk-UA")} {CURRENCY_NAMES[account.currencyCode] || ""}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {localToken ? "Натисніть оновити для завантаження карток" : "Введіть токен для завантаження карток"}
            </p>
          )}
        </div>

        <Button onClick={handleSave} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          Зберегти
        </Button>

        {/* Historical Data Loading Section */}
        <div className="pt-4 border-t space-y-3">
          <Label className="text-base font-semibold">Історичні дані</Label>
          
          {hasHistoricalData && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-sm text-emerald-700 font-medium flex items-center gap-2">
                <span className="text-emerald-600">✓</span>
                Історичні дані завантажено
              </p>
              {loadedPeriod.from && loadedPeriod.to && (
                <p className="text-sm text-emerald-600 mt-1">
                  Період: {format(new Date(loadedPeriod.from * 1000), "dd MMMM yyyy", { locale: uk })} — {format(new Date(loadedPeriod.to * 1000), "dd MMMM yyyy", { locale: uk })}
                </p>
              )}
            </div>
          )}
          
          <div className="space-y-2">
            <Label className="text-sm">Період для завантаження</Label>
            <div className="flex gap-2 flex-wrap">
              {[
                { label: "3 міс", months: 3 },
                { label: "6 міс", months: 6 },
                { label: "1 рік", months: 12 },
              ].map((preset) => {
                const presetFrom = subMonths(new Date(), preset.months);
                const isActive = 
                  Math.abs(historicalDateRange.from.getTime() - presetFrom.getTime()) < 86400000 * 7;
                
                return (
                  <Button
                    key={preset.months}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setHistoricalDateRange({ from: presetFrom, to: new Date() });
                    }}
                    disabled={isHistoricalLoading}
                  >
                    {preset.label}
                  </Button>
                );
              })}
              
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <CalendarIcon className="w-3 h-3 mr-1" />
                    {format(historicalDateRange.from, "dd.MM.yy", { locale: uk })} - {format(historicalDateRange.to, "dd.MM.yy", { locale: uk })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: historicalDateRange.from, to: historicalDateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setHistoricalDateRange({ from: range.from, to: range.to });
                        setCalendarOpen(false);
                      } else if (range?.from) {
                        setHistoricalDateRange(prev => ({ ...prev, from: range.from! }));
                      }
                    }}
                    numberOfMonths={2}
                    locale={uk}
                    disabled={isHistoricalLoading}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {historicalProgress && (
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700 flex items-center gap-2">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {historicalProgress}
              </p>
            </div>
          )}

          {historicalError && (
            <p className="text-xs text-red-500">{historicalError}</p>
          )}

          <div className="flex gap-2">
            <Button 
              onClick={handleLoadHistorical} 
              className="flex-1"
              variant="outline"
              disabled={isHistoricalLoading || !localToken || selectedAccounts.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              {isHistoricalLoading ? "Завантаження..." : "Завантажити історичні дані"}
            </Button>
            
            {isHistoricalLoading && (
              <Button 
                onClick={handleCancelLoading} 
                variant="destructive"
                size="sm"
              >
                Скасувати
              </Button>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground">
            Завантаження історичних даних може зайняти декілька хвилин через обмеження API Monobank (1 запит на хвилину).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
