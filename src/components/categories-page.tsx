"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Transaction, getCurrencySymbol } from "@/types";
import { getAllStoredTransactions, isHistoricalDataAvailable } from "@/lib/mono-sync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ChevronDown, Plus, CalendarIcon, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
import { format, subMonths, startOfMonth, endOfMonth, isSameMonth, eachWeekOfInterval, endOfWeek } from "date-fns";
import { uk } from "date-fns/locale";
import { isExpense } from "@/lib/monobank";
import { useBudgetStore } from "@/store/budget-store";
import { cn } from "@/lib/utils";
import { getMccCategory, getCategoryByKey, getAllCategories, MCC_CATEGORIES, getCategoryFromDescription } from "@/lib/mcc-categories";
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

interface WeekCategoryData {
  weekStart: Date;
  weekLabel: string;
  amount: number;
}

// Helper to get transaction category (custom > description > MCC)
function getTransactionCategory(tx: Transaction, transactionCategories: Record<string, string>): string {
  // 1. Check if manually assigned
  if (transactionCategories[tx.id]) {
    return transactionCategories[tx.id];
  }
  // 2. Check description-based category
  const descCategory = getCategoryFromDescription(tx.description);
  if (descCategory) {
    return descCategory;
  }
  // 3. Fall back to MCC
  return getMccCategory(tx.mcc);
}

export function CategoriesPage() {
  const { excludedTransactionIds, settings, transactionCategories, customCategories, setTransactionCategory, addCustomCategory, isLoading: globalLoading, setLoading: setGlobalLoading } = useBudgetStore();
  const [historicalTransactions, setHistoricalTransactions] = useState<Transaction[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newCategoryDialogOpen, setNewCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryIcon, setNewCategoryIcon] = useState("📁");
  const [newCategoryColor, setNewCategoryColor] = useState("#6366f1");
  
  // Date range state - default to current month
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const now = new Date();
    return { from: startOfMonth(now), to: now };
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  
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
        const categoryKey = getTransactionCategory(tx, transactionCategories);
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

  // Set default selected category
  useEffect(() => {
    if (categoryData.length > 0 && !selectedCategory) {
      setSelectedCategory(categoryData[0].key);
    }
  }, [categoryData, selectedCategory]);

  // Calculate weekly data for selected category (based on selected date range)
  const weeklyData = useMemo(() => {
    if (!selectedCategory) return [];

    const data: WeekCategoryData[] = [];

    // Get weeks within selected date range
    const weeks = eachWeekOfInterval(
      { start: dateRange.from, end: dateRange.to },
      { weekStartsOn: 1 }
    );

    weeks.forEach(weekStart => {
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

      const weekTransactions = historicalTransactions.filter(tx => {
        const txDate = new Date(tx.time * 1000);
        return txDate >= weekStart && txDate <= weekEnd;
      });

      const amount = weekTransactions
        .filter(tx => 
          isExpense(tx, historicalTransactions) && 
          !excludedTransactionIds.includes(tx.id) &&
          getTransactionCategory(tx, transactionCategories) === selectedCategory
        )
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

      data.push({
        weekStart,
        weekLabel: format(weekStart, "d MMM", { locale: uk }),
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
               getTransactionCategory(tx, transactionCategories) === selectedCategory &&
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
  const totalExpenses = categoryData.reduce((sum, c) => sum + c.total, 0);

  return (
    <div className="space-y-4">
      {/* Header with date range picker and refresh button */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            <div className="flex items-center justify-between mb-2">
              <span>Категорії витрат</span>
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
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: "1 міс", months: 0 },
                { label: "3 міс", months: 2 },
                { label: "6 міс", months: 5 },
                { label: "1 рік", months: 11 },
              ].map((preset) => {
                const now = new Date();
                const presetFrom = startOfMonth(subMonths(now, preset.months));
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
                    {format(dateRange.from, "d.MM", { locale: uk })} - {format(dateRange.to, "d.MM.yy", { locale: uk })}
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

      {/* Summary Card - Glassmorphism style matching calendar */}
      {categoryData.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-5 text-white">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10" />
          <div className="relative">
            <p className="text-xs text-white/60 uppercase tracking-wider mb-1">Всього витрачено</p>
            <p className="text-3xl font-light tracking-tight mb-4">
              {(totalExpenses / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
              <span className="text-lg text-white/60 ml-1">₴</span>
            </p>
            
            {/* Horizontal bar chart - minimalist */}
            <div className="space-y-2">
              {categoryData.slice(0, 5).map((cat) => {
                const percentage = totalExpenses > 0 ? (cat.total / totalExpenses) * 100 : 0;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setSelectedCategory(cat.key)}
                    className={cn(
                      "w-full text-left transition-all rounded-lg p-2 -mx-2",
                      selectedCategory === cat.key ? "bg-white/10" : "hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{cat.icon}</span>
                        <span className="text-sm font-medium text-white/90">{cat.name}</span>
                      </div>
                      <span className="text-sm tabular-nums text-white/70">
                        {(cat.total / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴
                      </span>
                    </div>
                    <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${percentage}%`,
                          backgroundColor: cat.color 
                        }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            
            {categoryData.length > 5 && (
              <p className="text-xs text-white/40 text-center mt-3">
                +{categoryData.length - 5} категорій
              </p>
            )}
          </div>
        </div>
      )}

      {/* Categories Grid - Modern cards */}
      {categoryData.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-muted-foreground">Всі категорії</h3>
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
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            {categoryData.map((category) => {
              const percentage = totalExpenses > 0 ? (category.total / totalExpenses) * 100 : 0;
              const isSelected = selectedCategory === category.key;
              
              return (
                <button
                  key={category.key}
                  onClick={() => setSelectedCategory(category.key)}
                  className={cn(
                    "relative p-3 rounded-xl text-left transition-all active:scale-[0.98]",
                    isSelected 
                      ? "bg-slate-900 text-white shadow-lg" 
                      : "bg-muted/30 hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-lg">{category.icon}</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full",
                      isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                    )}>
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                  <p className={cn(
                    "text-sm font-medium truncate",
                    isSelected ? "text-white" : "text-foreground"
                  )}>
                    {category.name}
                  </p>
                  <p className={cn(
                    "text-lg font-light tabular-nums",
                    isSelected ? "text-white/90" : "text-foreground/70"
                  )}>
                    {(category.total / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
                    <span className="text-xs ml-0.5">₴</span>
                  </p>
                  <p className={cn(
                    "text-[10px] mt-1",
                    isSelected ? "text-white/50" : "text-muted-foreground"
                  )}>
                    {category.count} транзакцій
                  </p>
                  
                  {/* Progress indicator */}
                  <div className={cn(
                    "absolute bottom-0 left-3 right-3 h-0.5 rounded-full overflow-hidden",
                    isSelected ? "bg-white/20" : "bg-muted"
                  )}>
                    <div 
                      className="h-full rounded-full transition-all duration-300"
                      style={{ 
                        width: `${percentage}%`,
                        backgroundColor: isSelected ? "white" : category.color 
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
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

      {/* Chart for selected category - weekly granulation */}
      {selectedCategory && selectedCategoryInfo && weeklyData.length > 0 && (
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
                  data={weeklyData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="weekLabel" 
                    tick={{ fontSize: 10 }}
                    stroke="#9ca3af"
                    interval={1}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    stroke="#9ca3af"
                    tickFormatter={(value: number) => `${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value) => [
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
