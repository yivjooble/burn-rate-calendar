"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Transaction, getCurrencySymbol } from "@/types";
import { getAllStoredTransactions, isHistoricalDataAvailable } from "@/lib/mono-sync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RefreshCw, ChevronDown, Plus, CalendarIcon, ArrowUpDown, ArrowUp, ArrowDown, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format, subMonths, startOfMonth, endOfMonth, isSameMonth, eachDayOfInterval } from "date-fns";
import { uk } from "date-fns/locale";
import { isExpense } from "@/lib/monobank";
import { useBudgetStore } from "@/store/budget-store";
import { cn } from "@/lib/utils";
import { getCategoryByKey, getAllCategories } from "@/lib/mcc-categories";
import { getTransactionCategoryKey, CategoryBudget, TopCategory, comparePeriods, getWarningBadge, calculateCategoryBudgets, getTopCategories } from "@/lib/category-utils";

// Helper functions for financial month calculations
function getFinancialMonthStart(date: Date, financialDayStart: number): Date {
  const start = new Date(date);
  if (start.getDate() >= financialDayStart) {
    start.setDate(financialDayStart);
  } else {
    start.setDate(financialDayStart);
    start.setMonth(start.getMonth() - 1);
  }
  start.setHours(0, 0, 0, 0);
  return start;
}

function getFinancialMonthEnd(date: Date, financialDayStart: number): Date {
  const start = getFinancialMonthStart(date, financialDayStart);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  end.setDate(financialDayStart - 1);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getPreviousFinancialMonthStart(date: Date, financialDayStart: number, monthsBack: number): Date {
  let currentStart = getFinancialMonthStart(date, financialDayStart);
  for (let i = 0; i < monthsBack; i++) {
    const prevDate = new Date(currentStart);
    prevDate.setDate(prevDate.getDate() - 1);
    currentStart = getFinancialMonthStart(prevDate, financialDayStart);
  }
  return currentStart;
}
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface CategoryData {
  key: string;
  name: string;
  icon: string;
  color: string;
  total: number;
  count: number;
  currencyCode?: number;
}

interface DayCategoryData {
  date: Date;
  dateLabel: string;
  amount: number;
}


export function CategoriesPage() {
  const { excludedTransactionIds, settings, transactionCategories, customCategories, setTransactionCategory, addCustomCategory, isLoading: globalLoading, setLoading: setGlobalLoading } = useBudgetStore();
  const financialDayStart = settings?.financialMonthStart || 1;
  const [historicalTransactions, setHistoricalTransactions] = useState<Transaction[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCategoryDialogOpen, setNewCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("📁");
  const [newCategoryColor, setNewCategoryColor] = useState("#6366f1");
  
  // Date range state - default to current financial month
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const now = new Date();
    const defaultFinancialDayStart = 1; // Use default for initialization
    const financialStart = getFinancialMonthStart(now, defaultFinancialDayStart);
    return { from: financialStart, to: now };
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  
  // Previous period data for trend comparison
  const [previousPeriodTotal, setPreviousPeriodTotal] = useState<number>(0);
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);
  
  // Update dateRange when financialDayStart changes or on mount
  useEffect(() => {
    const now = new Date();
    const currentFinancialStart = getFinancialMonthStart(now, financialDayStart);
    setDateRange({ from: currentFinancialStart, to: now });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [financialDayStart]);
  
  // Load previous period data for trend comparison
  const loadPreviousPeriod = useCallback(async () => {
    if (historicalTransactions.length === 0) return;
    
    setIsLoadingTrends(true);
    try {
      const periodLength = dateRange.to.getTime() - dateRange.from.getTime();
      const previousFrom = new Date(dateRange.from.getTime() - periodLength);
      const previousTo = new Date(dateRange.from.getTime() - 1);
      
      let previousTotal = 0;
      historicalTransactions.forEach(tx => {
        const txDate = new Date(tx.time * 1000);
        if (txDate >= previousFrom && txDate <= previousTo) {
          if (isExpense(tx, historicalTransactions) && !excludedTransactionIds.includes(tx.id)) {
            previousTotal += Math.abs(tx.amount);
          }
        }
      });
      
      setPreviousPeriodTotal(previousTotal);
    } finally {
      setIsLoadingTrends(false);
    }
  }, [historicalTransactions, dateRange, excludedTransactionIds]);

  // Load previous period when transactions are loaded or date range changes
  useEffect(() => {
    if (historicalTransactions.length > 0) {
      loadPreviousPeriod();
    }
  }, [historicalTransactions.length, dateRange, loadPreviousPeriod]);
  
  // Sorting state
  const [categorySortBy, setCategorySortBy] = useState<"amount" | "count" | "name">("amount");
  const [categorySortOrder, setCategorySortOrder] = useState<"asc" | "desc">("desc");
  const [transactionSortBy, setTransactionSortBy] = useState<"date" | "amount">("date");
  const [transactionSortOrder, setTransactionSortOrder] = useState<"asc" | "desc">("desc");

  // Get all available categories (standard + custom)
  const allCategories = useMemo(() => [
    ...getAllCategories(),
    ...customCategories.map(c => ({ key: c.id, category: { name: c.name, icon: c.icon, color: c.color } })),
  ], [customCategories]);

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    
    const newCategory = {
      id: `custom-${Date.now()}`,
      name: newCategoryName.trim(),
      icon: newCategoryIcon,
      color: newCategoryColor,
    };
    
    addCustomCategory(newCategory);
    setNewCategoryName("");
    setNewCategoryIcon("📁");
    setNewCategoryColor("#6366f1");
    setNewCategoryDialogOpen(false);
  };

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

  // Calculate category totals
  const categoryData = useMemo(() => {
    const categories: Record<string, CategoryData> = {};
    
    // Initialize all standard categories
    getAllCategories().forEach(({ key, category }) => {
      categories[key] = {
        key,
        name: category.name,
        icon: category.icon,
        color: category.color,
        total: 0,
        count: 0,
      };
    });

    // Add custom categories
    customCategories.forEach((cat) => {
      categories[cat.id] = {
        key: cat.id,
        name: cat.name,
        icon: cat.icon,
        color: cat.color,
        total: 0,
        count: 0,
      };
    });

    // Sum up expenses by category (filtered by date range)
    historicalTransactions
      .filter(tx => {
        const txDate = new Date(tx.time * 1000);
        return isExpense(tx, historicalTransactions) && 
               !excludedTransactionIds.includes(tx.id) &&
               txDate >= dateRange.from && txDate <= dateRange.to;
      })
      .forEach(tx => {
        const categoryKey = getTransactionCategoryKey(tx, transactionCategories);
        if (categories[categoryKey]) {
          categories[categoryKey].total += Math.abs(tx.amount);
          categories[categoryKey].count += 1;
          if (!categories[categoryKey].currencyCode) {
            categories[categoryKey].currencyCode = tx.currencyCode;
          }
        }
      });

    // Filter out empty categories and sort
    const filtered = Object.values(categories).filter(c => c.total > 0);
    
    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (categorySortBy) {
        case "amount":
          comparison = a.total - b.total;
          break;
        case "count":
          comparison = a.count - b.count;
          break;
        case "name":
          comparison = a.name.localeCompare(b.name, "uk");
          break;
      }
      return categorySortOrder === "asc" ? comparison : -comparison;
    });
  }, [historicalTransactions, excludedTransactionIds, customCategories, transactionCategories, dateRange, categorySortBy, categorySortOrder]);

  // ============================================
  // PHASE 1: CATEGORIES REDESIGN - COMPUTED VALUES
  // ============================================
  
  // Calculate total expenses first (used by multiple hooks)
  const totalExpenses = useMemo(() => categoryData.reduce((sum, c) => sum + c.total, 0), [categoryData]);
  
  // Calculate category budgets with progress tracking
  const categoryBudgets = useMemo((): CategoryBudget[] => {
    if (categoryData.length === 0) return [];
    const totalBudget = totalExpenses * 1.2; // 20% buffer by default
    return calculateCategoryBudgets(categoryData, totalBudget);
  }, [categoryData, totalExpenses]);
  
  // Get top 3 categories
  const topCategories = useMemo((): TopCategory[] => {
    if (categoryData.length === 0) return [];
    return getTopCategories(categoryData, totalExpenses);
  }, [categoryData, totalExpenses]);
  
  // Overall trend vs previous period
  const overallTrend = useMemo(() => comparePeriods(totalExpenses, previousPeriodTotal), [totalExpenses, previousPeriodTotal]);

  // Set default selected category
  useEffect(() => {
    if (categoryData.length > 0 && !selectedCategory) {
      setSelectedCategory(categoryData[0].key);
    }
  }, [categoryData, selectedCategory]);

  // Calculate daily data for selected category (based on selected date range)
  const dailyData = useMemo(() => {
    if (!selectedCategory) return [];

    const data: DayCategoryData[] = [];

    // Get all days within selected date range
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });

    days.forEach(day => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);

      const dayTransactions = historicalTransactions.filter(tx => {
        const txDate = new Date(tx.time * 1000);
        return txDate >= dayStart && txDate <= dayEnd;
      });

      const amount = dayTransactions
        .filter(tx => 
          isExpense(tx, historicalTransactions) && 
          !excludedTransactionIds.includes(tx.id) &&
          getTransactionCategoryKey(tx, transactionCategories) === selectedCategory
        )
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

      data.push({
        date: day,
        dateLabel: format(day, "d.MM", { locale: uk }),
        amount: Math.round(amount / 100),
      });
    });

    return data;
  }, [historicalTransactions, selectedCategory, excludedTransactionIds, transactionCategories, dateRange]);

  // Get transactions for selected category (filtered by date range, but include excluded for display)
  const categoryTransactions = useMemo(() => {
    if (!selectedCategory) return [];
    
    const filtered = historicalTransactions
      .filter(tx => {
        const txDate = new Date(tx.time * 1000);
        // Show all transactions including excluded ones (they will be displayed as strikethrough)
        return isExpense(tx, historicalTransactions) && 
               getTransactionCategoryKey(tx, transactionCategories) === selectedCategory &&
               txDate >= dateRange.from && txDate <= dateRange.to;
      });
    
    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (transactionSortBy) {
        case "date":
          comparison = a.time - b.time;
          break;
        case "amount":
          comparison = Math.abs(a.amount) - Math.abs(b.amount);
          break;
      }
      return transactionSortOrder === "asc" ? comparison : -comparison;
    });
  }, [historicalTransactions, selectedCategory, transactionCategories, dateRange, transactionSortBy, transactionSortOrder]);

  // Get selected category info (standard or custom)
  const selectedCategoryInfo = useMemo(() => {
    if (!selectedCategory) return null;
    
    // Get currencyCode from categoryData
    const catData = categoryData.find(c => c.key === selectedCategory);
    const currencyCode = catData?.currencyCode;
    
    // Check custom categories first
    const customCat = customCategories.find(c => c.id === selectedCategory);
    if (customCat) {
      return { name: customCat.name, icon: customCat.icon, color: customCat.color, currencyCode };
    }
    
    // Fall back to standard categories
    const stdCat = getCategoryByKey(selectedCategory);
    return stdCat ? { ...stdCat, currencyCode } : null;
  }, [selectedCategory, customCategories, categoryData]);

  return (
    <div className="space-y-4">
      {/* Header with date range picker and refresh button */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            <div className="mb-2">
              <span>Категорії витрат</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: "1 міс", months: 0 },
                { label: "3 міс", months: 2 },
                { label: "6 міс", months: 5 },
                { label: "1 рік", months: 11 },
              ].map((preset) => {
                const now = new Date();
                const presetFrom = getPreviousFinancialMonthStart(now, financialDayStart, preset.months);
                const currentFinancialStart = getFinancialMonthStart(now, financialDayStart);
                const isActive =
                  Math.abs(dateRange.from.getTime() - presetFrom.getTime()) < 86400000 &&
                  Math.abs(dateRange.to.getTime() - now.getTime()) < 86400000;

                return (
                  <Button
                    key={preset.months}
                    variant={isActive ? "default" : "ghost"}
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
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs font-normal">
                    <CalendarIcon className="w-3 h-3 mr-1" />
                    {dateRange.from.getFullYear() !== dateRange.to.getFullYear()
                      ? `${format(dateRange.from, "d.MM.yy", { locale: uk })} - ${format(dateRange.to, "d.MM.yy", { locale: uk })}`
                      : `${format(dateRange.from, "d.MM", { locale: uk })} - ${format(dateRange.to, "d.MM.yy", { locale: uk })}`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range) => {
                      if (range?.from && range?.to) {
                        setDateRange({ from: range.from, to: range.to });
                        setCalendarOpen(false);
                      } else if (range?.from) {
                        setDateRange(prev => ({ ...prev, from: range.from! }));
                      }
                    }}
                    numberOfMonths={2}
                    locale={uk}
                  />
                </PopoverContent>
              </Popover>
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={loadFromStorage}
                disabled={loadingHistory}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingHistory ? "animate-spin" : ""}`} />
                <span className="ml-1.5 text-xs">{loadingHistory ? "..." : "Оновити"}</span>
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {error && (
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-3">
            <p className="text-sm text-orange-700">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* ============================================ */}
      {/* PHASE 1: NEW COMPONENTS - TOP CATEGORIES & SUMMARY */}
      {/* ============================================ */}

      {/* Top 3 Categories Widget */}
      {topCategories.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span>🏆</span>
              <span>Топ категорії</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3">
              {topCategories.map((cat) => {
                const positionColors = {
                  1: "bg-yellow-50 border-yellow-200 text-yellow-800",
                  2: "bg-gray-50 border-gray-200 text-gray-800",
                  3: "bg-orange-50 border-orange-200 text-orange-800",
                };
                const positionEmojis = { 1: "🥇", 2: "🥈", 3: "🥉" };
                
                return (
                  <div
                    key={cat.key}
                    className={cn(
                      "relative p-3 rounded-xl border-2 transition-all hover:scale-105 cursor-pointer",
                      positionColors[cat.position]
                    )}
                    onClick={() => setSelectedCategory(cat.key)}
                  >
                    <div className="absolute -top-2 -right-2 text-lg">
                      {positionEmojis[cat.position]}
                    </div>
                    <div className="text-2xl mb-1">{cat.icon}</div>
                    <div className="text-xs font-medium truncate">{cat.name}</div>
                    <div className="text-sm font-bold">
                      {(cat.amount / 100).toLocaleString("uk-UA")} ₴
                    </div>
                    <div className="text-xs opacity-75">{cat.percentage}%</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overall Summary with Trend */}
      {categoryData.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Загальні витрати</p>
                <p className="text-2xl font-bold">
                  {(totalExpenses / 100).toLocaleString("uk-UA")} ₴
                </p>
              </div>
              
              <div className="flex items-center gap-4">
                {isLoadingTrends ? (
                  <div className="animate-pulse h-8 w-24 bg-muted rounded" />
                ) : (
                  <div className={cn(
                    "flex items-center gap-1 px-3 py-1.5 rounded-full",
                    overallTrend.direction === "up" ? "bg-red-50 text-red-600" :
                    overallTrend.direction === "down" ? "bg-green-50 text-green-600" :
                    "bg-gray-50 text-gray-600"
                  )}>
                    {overallTrend.direction === "up" ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : overallTrend.direction === "down" ? (
                      <TrendingDown className="w-4 h-4" />
                    ) : (
                      <Minus className="w-4 h-4" />
                    )}
                    <span className="text-sm font-medium">
                      {overallTrend.direction === "stable" ? "—" : 
                       `${overallTrend.direction === "up" ? "+" : "-"}${Math.abs(overallTrend.change)}%`}
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground text-right">
                  vs попередній<br />період
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Budget Progress Bars for Categories */}
      {categoryBudgets.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span>📊</span>
              <span>Бюджет за категоріями</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {categoryBudgets.slice(0, 6).map((category) => {
                const badge = getWarningBadge(category.status);
                const progressColor = 
                  category.status === "over" ? "bg-red-500" :
                  category.status === "warning" ? "bg-orange-500" :
                  "bg-green-500";
                
                return (
                  <div
                    key={category.key}
                    className={cn(
                      "p-3 rounded-lg border transition-all cursor-pointer",
                      selectedCategory === category.key ? "border-primary bg-muted/50" : "border-border"
                    )}
                    onClick={() => setSelectedCategory(category.key)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{category.icon}</span>
                        <span className="font-medium text-sm">{category.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={cn("text-xs", badge.color, badge.bgColor)}>
                          <span className="mr-1">{badge.icon}</span>
                          {badge.label}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="relative h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("absolute h-full rounded-full transition-all", progressColor)}
                        style={{ width: `${Math.min(category.percentage, 100)}%` }}
                      />
                      {category.percentage > 100 && (
                        <div
                          className="absolute h-full bg-red-600 rounded-full opacity-50"
                          style={{ 
                            width: `${Math.min((category.percentage - 100) / 2, 50)}%`,
                            left: "50%"
                          }}
                        />
                      )}
                    </div>
                    
                    <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                      <span>
                        {(category.spent / 100).toLocaleString("uk-UA")} ₴ / {(category.budget / 100).toLocaleString("uk-UA")} ₴
                      </span>
                      <span className={cn(
                        "font-medium",
                        category.status === "over" ? "text-red-600" :
                        category.status === "warning" ? "text-orange-500" :
                        "text-green-600"
                      )}>
                        {category.percentage}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pie Chart - Large with hover effects */}
      {categoryData.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="relative flex flex-col items-center">
              {/* Pie Chart */}
              <div className="w-72 h-72 md:w-80 md:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData.map(c => ({ ...c, value: c.total }))}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={120}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      onClick={(data) => setSelectedCategory(data.key)}
                      style={{ cursor: "pointer" }}
                    >
                      {categoryData.map((entry) => (
                        <Cell
                          key={entry.key}
                          fill={entry.color}
                          stroke={selectedCategory === entry.key ? "#000" : "transparent"}
                          strokeWidth={selectedCategory === entry.key ? 3 : 0}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number | string, name: string) => [
                        `${(Number(value) / 100).toLocaleString("uk-UA")} ₴`,
                        name
                      ]}
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Center text */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Всього</p>
                <p className="text-2xl font-light text-foreground">
                  {(totalExpenses / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
                  <span className="text-sm text-muted-foreground ml-0.5">₴</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Categories List */}
      {categoryData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>Всі категорії</span>
              </div>
              <Dialog open={newCategoryDialogOpen} onOpenChange={setNewCategoryDialogOpen}>
                <DialogTrigger asChild>
                  <button className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                    <Plus className="w-3 h-3" />
                    Додати
                  </button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Нова категорія</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label htmlFor="category-name">Назва</Label>
                      <Input
                        id="category-name"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="Наприклад: Підписки"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="category-icon">Іконка</Label>
                        <Input
                          id="category-icon"
                          value={newCategoryIcon}
                          onChange={(e) => setNewCategoryIcon(e.target.value)}
                          placeholder="📁"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="category-color">Колір</Label>
                        <Input
                          id="category-color"
                          type="color"
                          value={newCategoryColor}
                          onChange={(e) => setNewCategoryColor(e.target.value)}
                          className="h-10 p-1"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <span className="text-xl">{newCategoryIcon}</span>
                      <span className="font-medium" style={{ color: newCategoryColor }}>
                        {newCategoryName || "Попередній перегляд"}
                      </span>
                    </div>
                    <Button onClick={handleCreateCategory} className="w-full" disabled={!newCategoryName.trim()}>
                      Створити
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {categoryData.map((category) => {
                const percentage = totalExpenses > 0 ? (category.total / totalExpenses) * 100 : 0;
                const isSelected = selectedCategory === category.key;
                const budgetInfo = categoryBudgets.find(b => b.key === category.key);
                const badge = budgetInfo ? getWarningBadge(budgetInfo.status) : null;
                const progressColor = 
                  budgetInfo?.status === "over" ? "bg-red-500" :
                  budgetInfo?.status === "warning" ? "bg-orange-500" :
                  "bg-green-500";

                return (
                  <div
                    key={category.key}
                    className={cn(
                      "p-3 rounded-lg border transition-all cursor-pointer",
                      isSelected ? "border-primary bg-muted/50" : "border-border hover:border-muted-foreground/30"
                    )}
                    onClick={() => setSelectedCategory(category.key)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="text-xl">{category.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate flex items-center gap-2">
                            {category.name}
                            {badge && (
                              <Badge variant="outline" className={cn("text-xs px-1.5 py-0", badge.bgColor, badge.color)}>
                                <span className="mr-1">{badge.icon}</span>
                                {badge.label}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {category.count} транзакцій
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold" style={{ color: category.color }}>
                          {(category.total / 100).toLocaleString("uk-UA")} ₴
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="relative h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("absolute h-full rounded-full transition-all", progressColor)}
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions list for selected category */}
      {selectedCategory && selectedCategoryInfo && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{selectedCategoryInfo.icon}</span>
                <span>Транзакції: {selectedCategoryInfo.name}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                      <ArrowUpDown className="w-3 h-3 mr-1" />
                      {transactionSortBy === "date" ? "Дата" : "Сума"}
                      {transactionSortOrder === "desc" ? <ArrowDown className="w-3 h-3 ml-1" /> : <ArrowUp className="w-3 h-3 ml-1" />}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => { setTransactionSortBy("date"); setTransactionSortOrder("desc"); }}>
                      За датою (нові спочатку)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setTransactionSortBy("date"); setTransactionSortOrder("asc"); }}>
                      За датою (старі спочатку)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setTransactionSortBy("amount"); setTransactionSortOrder("desc"); }}>
                      За сумою (більші спочатку)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setTransactionSortBy("amount"); setTransactionSortOrder("asc"); }}>
                      За сумою (менші спочатку)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Badge variant="outline" className="font-normal">
                {categoryTransactions.length} транзакцій
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {categoryTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Немає транзакцій в цій категорії
              </p>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {categoryTransactions.map((tx) => {
                  const txDate = new Date(tx.time * 1000);
                  const isExcluded = excludedTransactionIds.includes(tx.id);
                  return (
                    <div
                      key={tx.id}
                      className={`flex items-center justify-between p-2 rounded-lg text-sm group ${
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
                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-1 px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors">
                              <span>Змінити</span>
                              <ChevronDown className="w-3 h-3" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                            {allCategories.map(({ key, category }) => (
                              <DropdownMenuItem
                                key={key}
                                onClick={() => setTransactionCategory(tx.id, key)}
                                className="cursor-pointer"
                              >
                                <span>{category.icon}</span>
                                <span>{category.name}</span>
                              </DropdownMenuItem>
                            ))}
                            {transactionCategories[tx.id] && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setTransactionCategory(tx.id, null)}
                                  className="cursor-pointer text-muted-foreground"
                                >
                                  Скинути категорію
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <div className={`font-bold ${isExcluded ? "line-through text-muted-foreground" : ""}`} style={{ color: isExcluded ? undefined : selectedCategoryInfo.color }}>
                          {(Math.abs(tx.amount) / 100).toLocaleString("uk-UA")} {getCurrencySymbol(tx.currencyCode)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chart for selected category - daily granulation */}
      {selectedCategory && selectedCategoryInfo && dailyData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span>{selectedCategoryInfo.icon}</span>
              <span>{selectedCategoryInfo.name}</span>
              <Badge variant="outline" className="ml-auto font-normal">
                {format(dateRange.from, "d MMM", { locale: uk })} — {format(dateRange.to, "d MMM", { locale: uk })}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={dailyData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="dateLabel" 
                    tick={{ fontSize: 10 }}
                    stroke="#9ca3af"
                    interval={Math.max(0, Math.floor(dailyData.length / 10))}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    tickFormatter={(value: number) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value: number | string) => [
                      `${Number(value).toLocaleString("uk-UA")} ${getCurrencySymbol(selectedCategoryInfo.currencyCode)}`,
                      selectedCategoryInfo.name
                    ]}
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
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-4 h-0.5" 
                            style={{ backgroundColor: selectedCategoryInfo.color }} 
                          />
                          <span className="text-xs text-muted-foreground">
                            {selectedCategoryInfo.name}
                          </span>
                        </div>
                      </div>
                    )}
                  />
                  <Line
                    type="monotone"
                    dataKey="amount"
                    name={selectedCategoryInfo.name}
                    stroke={selectedCategoryInfo.color}
                    strokeWidth={2}
                    dot={{ fill: selectedCategoryInfo.color, strokeWidth: 1, r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
