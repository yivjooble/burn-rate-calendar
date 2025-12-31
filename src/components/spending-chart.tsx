"use client";

import { useState, useEffect, useCallback } from "react";
import { Transaction, getCurrencySymbol } from "@/types";
import { getAllStoredTransactions, isHistoricalDataAvailable } from "@/lib/mono-sync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw, 
  TrendingDown,
  TrendingUp,
  Calendar
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, endOfWeek, eachWeekOfInterval, isWithinInterval } from "date-fns";
import { uk } from "date-fns/locale";
import { isExpense, isIncome } from "@/lib/monobank";
import { useBudgetStore } from "@/store/budget-store";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface WeekData {
  weekStart: Date;
  weekEnd: Date;
  expenses: number;
  income: number;
  transactions: Transaction[];
}

interface SpendingChartProps {
  onRefresh: () => Promise<void>;
  isLoading: boolean;
}

export function SpendingChart({ onRefresh, isLoading }: SpendingChartProps) {
  const { excludedTransactionIds, settings, setLoading: setGlobalLoading } = useBudgetStore();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const now = new Date();
    return {
      from: startOfMonth(now),
      to: now,
    };
  });
  const [weeksData, setWeeksData] = useState<WeekData[]>([]);
  const [historicalTransactions, setHistoricalTransactions] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [activeMetric, setActiveMetric] = useState<string | null>(null);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [incomeSearchQuery, setIncomeSearchQuery] = useState("");
  const [incomeSortBy, setIncomeSortBy] = useState<"date" | "amount">("date");
  const [incomeSortOrder, setIncomeSortOrder] = useState<"asc" | "desc">("desc");
  const [expensesModalOpen, setExpensesModalOpen] = useState(false);
  const [expensesSearchQuery, setExpensesSearchQuery] = useState("");
  const [expensesSortBy, setExpensesSortBy] = useState<"date" | "amount">("date");
  const [expensesSortOrder, setExpensesSortOrder] = useState<"asc" | "desc">("desc");

  const selectMetric = (metric: string) => {
    setActiveMetric(prev => prev === metric ? null : metric);
  };

  const isMetricVisible = (metric: string) => {
    return activeMetric === null || activeMetric === metric;
  };

  // Calculate month boundaries for API calls
  const getMonthBoundaries = (date: Date) => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    return {
      from: Math.floor(start.getTime() / 1000),
      to: Math.floor(end.getTime() / 1000),
    };
  };

  // Calculate months needed based on date range
  const getMonthsInRange = useCallback(() => {
    if (!dateRange?.from || !dateRange?.to) return [];
    const months: Date[] = [];
    let current = startOfMonth(dateRange.from);
    const end = endOfMonth(dateRange.to);
    while (current <= end) {
      months.push(current);
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    }
    return months;
  }, [dateRange]);

  // Fetch historical data for selected date range
  // Load transactions from IndexedDB (no API calls needed)
  const loadFromStorage = useCallback(async () => {
    setLoadingHistory(true);
    setGlobalLoading(true);
    setError(null);

    try {
      const hasData = await isHistoricalDataAvailable();
      if (!hasData) {
        setError("Історичні дані відсутні. Натисніть 'Оновити' на головній сторінці для завантаження.");
        return;
      }

      const allTransactions = await getAllStoredTransactions();
      setHistoricalTransactions(allTransactions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка завантаження даних");
    } finally {
      setLoadingHistory(false);
      setGlobalLoading(false);
    }
  }, [setGlobalLoading]);

  // Load data from IndexedDB on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Process transactions into weekly data
  useEffect(() => {
    if (!dateRange?.from || !dateRange?.to) return;

    const weeks = eachWeekOfInterval(
      { start: dateRange.from, end: dateRange.to },
      { weekStartsOn: 1 }
    );

    const data: WeekData[] = weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      
      const weekTransactions = historicalTransactions.filter(tx => {
        const txDate = new Date(tx.time * 1000);
        return isWithinInterval(txDate, { start: weekStart, end: weekEnd });
      });

      const expenses = weekTransactions
        .filter(tx => isExpense(tx, weekTransactions) && !excludedTransactionIds.includes(tx.id))
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

      const income = weekTransactions
        .filter(tx => isIncome(tx, weekTransactions))
        .reduce((sum, tx) => sum + tx.amount, 0);

      return {
        weekStart,
        weekEnd,
        expenses,
        income,
        transactions: weekTransactions,
      };
    });

    setWeeksData(data);
  }, [historicalTransactions, dateRange, excludedTransactionIds]);

  const totalExpenses = weeksData.reduce((sum, d) => sum + d.expenses, 0);
  const totalIncome = weeksData.reduce((sum, d) => sum + d.income, 0);
  const avgWeeklyExpenses = weeksData.length > 0 ? totalExpenses / weeksData.length : 0;

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Pre-defined periods */}
        {[
          { label: "1 міс", months: 0 },
          { label: "3 міс", months: 2 },
          { label: "6 міс", months: 5 },
          { label: "1 рік", months: 11 },
        ].map((preset) => {
          const now = new Date();
          const presetFrom = startOfMonth(subMonths(now, preset.months));
          const isActive = dateRange?.from && dateRange?.to &&
            Math.abs(dateRange.from.getTime() - presetFrom.getTime()) < 86400000 &&
            Math.abs(dateRange.to.getTime() - now.getTime()) < 86400000;

          return (
            <Button
              key={preset.months}
              variant={isActive ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setDateRange({ from: presetFrom, to: now });
              }}
            >
              {preset.label}
            </Button>
          );
        })}

        {/* Custom date picker */}
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs font-normal"
            >
              <Calendar className="w-3 h-3 mr-1" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <>
                    {format(dateRange.from, "d.MM", { locale: uk })} – {format(dateRange.to, "d.MM.yy", { locale: uk })}
                  </>
                ) : (
                  format(dateRange.from, "d.MM.yy", { locale: uk })
                )
              ) : (
                <span>Період</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <CalendarComponent
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={(range) => {
                setDateRange(range);
                if (range?.from && range?.to) {
                  setIsCalendarOpen(false);
                }
              }}
              numberOfMonths={2}
              locale={uk}
            />
          </PopoverContent>
        </Popover>

        {/* Refresh button */}
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={loadFromStorage}
          disabled={loadingHistory}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && (
        <Card className="bg-red-50 border-red-200 py-0">
          <CardContent className="p-2">
            <p className="text-xs text-red-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card 
          className="py-0 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setExpensesModalOpen(true)}
        >
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-xs">Всього витрат</span>
            </div>
            <div className="text-lg font-bold text-red-500">
              {(totalExpenses / 100).toLocaleString("uk-UA")} ₴
            </div>
          </CardContent>
        </Card>

        <Card 
          className="py-0 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => setIncomeModalOpen(true)}
        >
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <span className="text-xs">Всього доходів</span>
            </div>
            <div className="text-lg font-bold text-emerald-500">
              {(totalIncome / 100).toLocaleString("uk-UA")} ₴
            </div>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-xs">Середні витрати/тиждень</span>
            </div>
            <div className="text-lg font-bold">
              {(avgWeeklyExpenses / 100).toLocaleString("uk-UA")} ₴
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Line Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Витрати та доходи по тижнях</span>
            {dateRange?.from && dateRange?.to && (
              <Badge variant="outline" className="font-normal">
                {format(dateRange.from, "dd MMM yyyy", { locale: uk })} - {format(dateRange.to, "dd MMM yyyy", { locale: uk })}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {weeksData.length === 0 || historicalTransactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm">Натисніть "Оновити" щоб завантажити дані</p>
              {!settings.monoToken && (
                <p className="text-xs mt-2 text-orange-500">Спочатку введіть токен Monobank в налаштуваннях</p>
              )}
            </div>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={weeksData.map(d => ({
                    name: format(d.weekStart, "dd.MM", { locale: uk }),
                    expenses: Math.round(d.expenses / 100),
                    income: Math.round(d.income / 100),
                    balance: Math.round((d.income - d.expenses) / 100),
                  }))}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    tickFormatter={(value: number) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      `${Number(value).toLocaleString("uk-UA")} ₴`,
                      name
                    ]}
                    itemSorter={(item) => {
                      const order: Record<string, number> = { "Доходи": 0, "Витрати": 1, "Баланс": 2 };
                      return order[item.name as string] ?? 99;
                    }}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Legend 
                    content={() => (
                      <div className="flex justify-center gap-6 mt-2">
                        <button
                          onClick={() => selectMetric('income')}
                          className={`flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity ${activeMetric && activeMetric !== 'income' ? 'opacity-40' : ''}`}
                        >
                          <div className="w-4 h-0.5 bg-emerald-400" />
                          <span className="text-xs text-muted-foreground">Доходи</span>
                        </button>
                        <button
                          onClick={() => selectMetric('expenses')}
                          className={`flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity ${activeMetric && activeMetric !== 'expenses' ? 'opacity-40' : ''}`}
                        >
                          <div className="w-4 h-0.5 bg-red-400" />
                          <span className="text-xs text-muted-foreground">Витрати</span>
                        </button>
                        <button
                          onClick={() => selectMetric('balance')}
                          className={`flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity ${activeMetric && activeMetric !== 'balance' ? 'opacity-40' : ''}`}
                        >
                          <div className="w-4 h-0.5 bg-blue-400 border-dashed" style={{ borderTop: "2px dashed #60a5fa", height: 0 }} />
                          <span className="text-xs text-muted-foreground">Баланс</span>
                        </button>
                      </div>
                    )}
                  />
                  {isMetricVisible('income') && (
                    <Line
                      type="monotone"
                      dataKey="income"
                      name="Доходи"
                      stroke="#34d399"
                      strokeWidth={3}
                      dot={{ fill: "#34d399", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  )}
                  {isMetricVisible('expenses') && (
                    <Line
                      type="monotone"
                      dataKey="expenses"
                      name="Витрати"
                      stroke="#f87171"
                      strokeWidth={3}
                      dot={{ fill: "#f87171", strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  )}
                  {isMetricVisible('balance') && (
                    <Line
                      type="monotone"
                      dataKey="balance"
                      name="Баланс"
                      stroke="#60a5fa"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: "#60a5fa", strokeWidth: 2, r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Income Modal */}
      <Dialog open={incomeModalOpen} onOpenChange={setIncomeModalOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Надходження за період
              {dateRange?.from && dateRange?.to && (
                <Badge variant="outline" className="ml-2 font-normal">
                  {format(dateRange.from, "dd.MM.yy", { locale: uk })} – {format(dateRange.to, "dd.MM.yy", { locale: uk })}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Пошук за назвою або сумою..."
                value={incomeSearchQuery}
                onChange={(e) => setIncomeSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (incomeSortBy === "date") {
                  setIncomeSortBy("amount");
                } else {
                  setIncomeSortOrder(prev => prev === "desc" ? "asc" : "desc");
                  if (incomeSortOrder === "asc") setIncomeSortBy("date");
                }
              }}
              className="shrink-0"
            >
              {incomeSortBy === "date" ? "Дата" : "Сума"} {incomeSortOrder === "desc" ? "↓" : "↑"}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {historicalTransactions
              .filter(tx => {
                if (!dateRange?.from || !dateRange?.to) return false;
                const txDate = new Date(tx.time * 1000);
                return txDate >= dateRange.from && txDate <= dateRange.to;
              })
              .filter(tx => isIncome(tx, historicalTransactions))
              .filter(tx => {
                if (incomeSearchQuery === "") return true;
                const query = incomeSearchQuery.toLowerCase();
                const amountStr = (tx.amount / 100).toString();
                return tx.description.toLowerCase().includes(query) || amountStr.includes(query);
              })
              .sort((a, b) => {
                const multiplier = incomeSortOrder === "desc" ? -1 : 1;
                if (incomeSortBy === "date") return multiplier * (a.time - b.time);
                return multiplier * (a.amount - b.amount);
              })
              .map(tx => {
                const txDate = new Date(tx.time * 1000);
                const isExcluded = excludedTransactionIds.includes(tx.id);
                return (
                  <div
                    key={tx.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      isExcluded ? "bg-muted/20 opacity-50" : "bg-muted/30"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium truncate ${isExcluded ? "line-through text-muted-foreground" : ""}`}>
                        {tx.description}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(txDate, "d MMM yyyy, HH:mm", { locale: uk })}
                        {isExcluded && <span className="ml-2 text-orange-500">(виключено)</span>}
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <div className={`font-bold ${isExcluded ? "line-through text-muted-foreground" : "text-emerald-500"}`}>
                        +{(tx.amount / 100).toLocaleString("uk-UA")} {getCurrencySymbol(tx.currencyCode)}
                      </div>
                    </div>
                  </div>
                );
              })}
            {historicalTransactions
              .filter(tx => {
                if (!dateRange?.from || !dateRange?.to) return false;
                const txDate = new Date(tx.time * 1000);
                return txDate >= dateRange.from && txDate <= dateRange.to;
              })
              .filter(tx => isIncome(tx, historicalTransactions))
              .filter(tx => {
                if (incomeSearchQuery === "") return true;
                const query = incomeSearchQuery.toLowerCase();
                const amountStr = (tx.amount / 100).toString();
                return tx.description.toLowerCase().includes(query) || amountStr.includes(query);
              })
              .length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {incomeSearchQuery ? "Нічого не знайдено" : "Немає надходжень за обраний період"}
              </div>
            )}
          </div>
          <div className="pt-3 border-t mt-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Всього надходжень:</span>
              <span className="text-lg font-bold text-emerald-500">
                {(totalIncome / 100).toLocaleString("uk-UA")} ₴
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Expenses Modal */}
      <Dialog open={expensesModalOpen} onOpenChange={setExpensesModalOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-500" />
              Витрати за період
              {dateRange?.from && dateRange?.to && (
                <Badge variant="outline" className="ml-2 font-normal">
                  {format(dateRange.from, "dd.MM.yy", { locale: uk })} – {format(dateRange.to, "dd.MM.yy", { locale: uk })}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Пошук за назвою або сумою..."
                value={expensesSearchQuery}
                onChange={(e) => setExpensesSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (expensesSortBy === "date") {
                  setExpensesSortBy("amount");
                } else {
                  setExpensesSortOrder(prev => prev === "desc" ? "asc" : "desc");
                  if (expensesSortOrder === "asc") setExpensesSortBy("date");
                }
              }}
              className="shrink-0"
            >
              {expensesSortBy === "date" ? "Дата" : "Сума"} {expensesSortOrder === "desc" ? "↓" : "↑"}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {historicalTransactions
              .filter(tx => {
                if (!dateRange?.from || !dateRange?.to) return false;
                const txDate = new Date(tx.time * 1000);
                return txDate >= dateRange.from && txDate <= dateRange.to;
              })
              .filter(tx => isExpense(tx, historicalTransactions))
              .filter(tx => {
                if (expensesSearchQuery === "") return true;
                const query = expensesSearchQuery.toLowerCase();
                const amountStr = (Math.abs(tx.amount) / 100).toString();
                return tx.description.toLowerCase().includes(query) || amountStr.includes(query);
              })
              .sort((a, b) => {
                const multiplier = expensesSortOrder === "desc" ? -1 : 1;
                if (expensesSortBy === "date") return multiplier * (a.time - b.time);
                return multiplier * (Math.abs(a.amount) - Math.abs(b.amount));
              })
              .map(tx => {
                const txDate = new Date(tx.time * 1000);
                const isExcluded = excludedTransactionIds.includes(tx.id);
                return (
                  <div
                    key={tx.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      isExcluded ? "bg-muted/20 opacity-50" : "bg-muted/30"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium truncate ${isExcluded ? "line-through text-muted-foreground" : ""}`}>
                        {tx.description}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {format(txDate, "d MMM yyyy, HH:mm", { locale: uk })}
                        {isExcluded && <span className="ml-2 text-orange-500">(виключено)</span>}
                      </div>
                    </div>
                    <div className="text-right ml-3">
                      <div className={`font-bold ${isExcluded ? "line-through text-muted-foreground" : "text-red-500"}`}>
                        {(tx.amount / 100).toLocaleString("uk-UA")} {getCurrencySymbol(tx.currencyCode)}
                      </div>
                    </div>
                  </div>
                );
              })}
            {historicalTransactions
              .filter(tx => {
                if (!dateRange?.from || !dateRange?.to) return false;
                const txDate = new Date(tx.time * 1000);
                return txDate >= dateRange.from && txDate <= dateRange.to;
              })
              .filter(tx => isExpense(tx, historicalTransactions))
              .filter(tx => {
                if (expensesSearchQuery === "") return true;
                const query = expensesSearchQuery.toLowerCase();
                const amountStr = (Math.abs(tx.amount) / 100).toString();
                return tx.description.toLowerCase().includes(query) || amountStr.includes(query);
              })
              .length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                {expensesSearchQuery ? "Нічого не знайдено" : "Немає витрат за обраний період"}
              </div>
            )}
          </div>
          <div className="pt-3 border-t mt-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Всього витрат:</span>
              <span className="text-lg font-bold text-red-500">
                {(totalExpenses / 100).toLocaleString("uk-UA")} ₴
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
