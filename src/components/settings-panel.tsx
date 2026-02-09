"use client";

import { useState, useEffect } from "react";
import { useBudgetStore } from "@/store/budget-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings, Eye, EyeOff, Save, RefreshCw, CreditCard, Download, CalendarIcon, Trash2, Check, Lock, AlertCircle, CheckCircle2, Brain } from "lucide-react";
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
  const [localToken, setLocalToken] = useState("");
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [tokenSaving, setTokenSaving] = useState(false);
  const [tokenDeleting, setTokenDeleting] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    settings.accountId || ""
  );
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [accountsError, setAccountsError] = useState<string | null>(null);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Check if token exists on server
  useEffect(() => {
    const checkToken = async () => {
      try {
        const response = await fetch("/api/db/mono-token");
        const data = await response.json();
        setHasStoredToken(data.hasToken);
      } catch (error) {
        console.error("Failed to check token status:", error);
      }
    };
    checkToken();
  }, []);
  
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
        // If period is not saved (legacy data), calculate from transactions
        if (!period.from || !period.to) {
          const allTx = await getAllStoredTransactions();
          if (allTx.length > 0) {
            const times = allTx.map(tx => tx.time);
            const minTime = Math.min(...times);
            const maxTime = Math.max(...times);
            setLoadedPeriod({ from: minTime, to: maxTime });
          } else {
            setLoadedPeriod(period);
          }
        } else {
          setLoadedPeriod(period);
        }
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
    if (!hasStoredToken) {
      setHistoricalError("Спочатку збережіть токен Monobank");
      return;
    }
    if (!selectedAccountId) {
      setHistoricalError("Оберіть картку");
      return;
    }

    const controller = new AbortController();
    setAbortController(controller);
    setHistoricalLoading(true);
    setHistoricalError(null);
    setHistoricalProgress("Початок завантаження...");

    try {
      // Token is now retrieved from DB server-side via proxy
      await loadHistoricalData(
        [selectedAccountId],
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
    if (!hasStoredToken) {
      setAccountsError("Спочатку збережіть токен");
      return;
    }
    setLoadingAccounts(true);
    setAccountsError(null);
    try {
      // Use proxy API - token is retrieved from DB server-side
      const response = await fetch("/api/mono/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: "/personal/client-info" }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Помилка завантаження");
      }
      const data = await response.json();
      const accounts = data.accounts || [];
      setCachedAccounts(accounts);
      // Auto-select first UAH account if none selected
      if (!selectedAccountId && accounts.length > 0) {
        const uahAccount = accounts.find((a: { currencyCode: number }) => a.currencyCode === 980);
        if (uahAccount) {
          setSelectedAccountId(uahAccount.id);
        }
      }
    } catch (err) {
      setAccountsError(err instanceof Error ? err.message : "Помилка");
    } finally {
      setLoadingAccounts(false);
    }
  };

  // No auto-fetch - accounts are only loaded manually via refresh button

  const selectAccount = (accountId: string) => {
    setSelectedAccountId(accountId);
  };

  const getAccountLabel = (account: { currencyCode: number; type: string; maskedPan?: string[] }) => {
    const currency = CURRENCY_NAMES[account.currencyCode] || account.currencyCode;
    const type = CARD_TYPE_NAMES[account.type] || account.type;
    const maskedPan = account.maskedPan?.[0] || "";
    const lastDigits = maskedPan.slice(-4);
    return `${type} ${currency}${lastDigits ? ` (*${lastDigits})` : ""}`;
  };

  const handleSave = () => {
    // Get the selected account's details
    const selectedAccount = cachedAccounts.find(a => a.id === selectedAccountId);

    // Note: monoToken is stored separately via /api/db/mono-token
    // and is NEVER passed to client or stored in localStorage
    setSettings({
      accountId: selectedAccountId,
      accountBalance: selectedAccount?.balance || 0,
      accountCurrency: selectedAccount?.currencyCode || 980,
    });
    onSave?.();
  };

  const handlePasswordChange = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);

    // Client-side validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("Заповніть всі поля");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Паролі не співпадають");
      return;
    }

    if (newPassword.length < 12) {
      setPasswordError("Пароль має бути мінімум 12 символів");
      return;
    }

    setPasswordChanging(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setPasswordError(data.error || "Помилка зміни пароля");
        return;
      }

      setPasswordSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Hide success message after 3 seconds
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch {
      setPasswordError("Помилка з'єднання");
    } finally {
      setPasswordChanging(false);
    }
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
          <Label htmlFor="token">Monobank Token</Label>

          {hasStoredToken ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>Токен збережено</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-7 text-xs text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    if (!confirm("Ви впевнені, що хочете видалити токен?")) return;
                    setTokenDeleting(true);
                    try {
                      const response = await fetch("/api/db/mono-token", { method: "DELETE" });
                      if (response.ok) {
                        setHasStoredToken(false);
                        setCachedAccounts([]);
                      }
                    } finally {
                      setTokenDeleting(false);
                    }
                  }}
                  disabled={tokenDeleting}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  {tokenDeleting ? "..." : "Видалити"}
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  id="token"
                  type={showToken ? "text" : "password"}
                  value={localToken}
                  onChange={(e) => setLocalToken(e.target.value)}
                  placeholder="Новий токен (якщо потрібно замінити)"
                  className="flex-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="px-3 text-muted-foreground hover:text-foreground"
                >
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {localToken && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    setTokenSaving(true);
                    try {
                      const response = await fetch("/api/db/mono-token", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ token: localToken }),
                      });
                      if (response.ok) {
                        setLocalToken("");
                        setHasStoredToken(true);
                      }
                    } finally {
                      setTokenSaving(false);
                    }
                  }}
                  disabled={tokenSaving}
                >
                  {tokenSaving ? "Збереження..." : "Оновити токен"}
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
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
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {localToken && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    setTokenSaving(true);
                    try {
                      const response = await fetch("/api/db/mono-token", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ token: localToken }),
                      });
                      if (response.ok) {
                        setLocalToken("");
                        setHasStoredToken(true);
                      }
                    } finally {
                      setTokenSaving(false);
                    }
                  }}
                  disabled={tokenSaving}
                >
                  {tokenSaving ? "Збереження..." : "Зберегти токен"}
                </Button>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Токен зберігається зашифрованим на сервері.
          </p>

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

        {/* Account Selection - Single card */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Оберіть картку</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchAccounts}
              disabled={loadingAccounts || !hasStoredToken}
            >
              <RefreshCw className={`w-3 h-3 ${loadingAccounts ? "animate-spin" : ""}`} />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Бюджет буде розраховуватись з поточного балансу обраної картки
          </p>
          {accountsError && (
            <p className="text-xs text-red-500">{accountsError}</p>
          )}
          {cachedAccounts.filter(a => !['eAid', 'madeInUkraine'].includes(a.type)).length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {cachedAccounts
                .filter(account => !['eAid', 'madeInUkraine'].includes(account.type))
                .map((account) => {
                  const isSelected = selectedAccountId === account.id;
                  return (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => selectAccount(account.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
                      }`}>
                        {isSelected && <Check className="w-3 h-3 text-primary-foreground" />}
                      </div>
                      <CreditCard className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{getAccountLabel(account)}</div>
                        <div className="text-xs text-muted-foreground">
                          Баланс: {(account.balance / 100).toLocaleString("uk-UA")} {CURRENCY_NAMES[account.currencyCode] || ""}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {hasStoredToken ? "Натисніть оновити для завантаження карток" : "Збережіть токен для завантаження карток"}
            </p>
          )}
        </div>

        <Button onClick={handleSave} className="w-full">
          <Save className="w-4 h-4 mr-2" />
          Зберегти
        </Button>

        {/* Financial Month Settings */}
        <div className="pt-4 border-t space-y-3">
          <Label className="text-base font-semibold flex items-center gap-2">
            <CalendarIcon className="w-4 h-4" />
            Фінансовий місяць
          </Label>
          
          <div className="space-y-2">
            <Label className="text-sm">Початок фінансового місяця</Label>
            <div className="flex items-center gap-2">
              <select
                value={settings.financialMonthStart || 1}
                onChange={(e) => setSettings({ financialMonthStart: Number(e.target.value) })}
                className="flex-1 p-2 border rounded-md text-sm"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                  <option key={day} value={day}>
                    {day} числа
                  </option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground">
                {settings.financialMonthStart || 1} числа кожного місяця
              </span>
            </div>
          </div>
          
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              Фінансовий місяць визначає, як розраховується ваш бюджет. 
              Наприклад, якщо обрано &quot;5 числа&quot;, то ваш фінансовий місяць триває з 5 числа поточного місяця по 4 числа наступного.
            </p>
          </div>
        </div>

        {/* AI Budget Settings */}
        <div className="pt-4 border-t space-y-3">
          <Label className="text-base font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4" />
            AI-розподіл бюджету
          </Label>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="useAIBudget"
                checked={settings.useAIBudget ?? true}
                onChange={(e) => setSettings({ useAIBudget: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="useAIBudget" className="text-sm">
                Використовувати AI для розподілу бюджету
              </Label>
            </div>
          </div>
          
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              AI аналізує ваші історичні витрати та створює персоналізовані денні ліміти. 
              Система враховує патерни витрат по днях тижня та категоріях для точніших прогнозів.
            </p>
          </div>
        </div>

        {/* Historical Data Loading Section */}
        <div className="pt-4 border-t space-y-3">
          <Label className="text-base font-semibold">Історичні дані</Label>
          
          {hasHistoricalData && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Дані завантажено</span>
              {loadedPeriod.from && loadedPeriod.to && (
                <span className="text-xs">
                  ({format(new Date(loadedPeriod.from * 1000), "dd.MM.yy", { locale: uk })} — {format(new Date(loadedPeriod.to * 1000), "dd.MM.yy", { locale: uk })})
                </span>
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
              disabled={isHistoricalLoading || !hasStoredToken || !selectedAccountId}
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

        {/* Password Change Section */}
        <div className="pt-4 border-t space-y-3">
          <Label className="text-base font-semibold flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Змінити пароль
          </Label>

          {passwordError && (
            <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>Пароль успішно змінено!</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-sm">Поточний пароль</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-sm">Новий пароль</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Мінімум 12 символів"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-sm">Підтвердіть новий пароль</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторіть новий пароль"
            />
          </div>

          <Button
            onClick={handlePasswordChange}
            variant="outline"
            className="w-full"
            disabled={passwordChanging || !currentPassword || !newPassword || !confirmPassword}
          >
            <Lock className="w-4 h-4 mr-2" />
            {passwordChanging ? "Зміна пароля..." : "Змінити пароль"}
          </Button>

          <p className="text-xs text-muted-foreground">
            Пароль має містити мінімум 12 символів, велику та малу літеру, цифру та спецсимвол.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
