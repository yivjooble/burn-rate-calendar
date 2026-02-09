"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Transaction } from "@/types";
import { getAllStoredTransactions, isHistoricalDataAvailable } from "@/lib/mono-sync";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Flame,
  Target,
  DollarSign,
  Calendar,
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  Info
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, startOfWeek, endOfWeek } from "date-fns";
import { uk } from "date-fns/locale";
import { isExpense } from "@/lib/monobank";
import { useBudgetStore } from "@/store/budget-store";
import { cn } from "@/lib/utils";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
  RadialBarChart,
  RadialBar,
} from "recharts";
import { 
  calculateBurnRate, 
  calculateKPIs, 
  analyzeDayOfWeek, 
  generateInsights,
  BurnRateData,
  KPIData,
  DayOfWeekAnalysis,
  Insight
} from "@/lib/category-utils";

// ============================================
// PHASE 2: STATISTICS VIEW COMPONENT
// ============================================

interface StatisticsViewProps {
  onRefresh?: () => Promise<void>;
  isLoading?: boolean;
}

export function StatisticsView({ onRefresh, isLoading: externalLoading }: StatisticsViewProps) {
  const { excludedTransactionIds, settings, transactionCategories, customCategories, setLoading: setGlobalLoading } = useBudgetStore();
  const financialDayStart = settings?.financialMonthStart || 1;
  
  // State
  const [historicalTransactions, setHistoricalTransactions] = useState<Transaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load transactions
  const loadFromStorage = useCallback(async () => {
    setLoadingHistory(true);
    setGlobalLoading(true);
    setError(null);

    try {
      const hasData = await isHistoricalDataAvailable();
      if (!hasData) {
        setError("Історичні дані відсутні. Натисніть 'Оновити' для завантаження.");
        return;
      }

      const allTransactions = await getAllStoredTransactions();
      setHistoricalTransactions(allTransactions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка завантаження");
    } finally {
      setLoadingHistory(false);
      setGlobalLoading(false);
    }
  }, [setGlobalLoading]);

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Calculate current financial month
  const currentDate = new Date();
  const currentFinancialStart = (() => {
    const d = new Date(currentDate);
    if (d.getDate() >= financialDayStart) {
      d.setDate(financialDayStart);
    } else {
      d.setMonth(d.getMonth() - 1);
      d.setDate(financialDayStart);
    }
    d.setHours(0, 0, 0, 0);
    return d;
  })();
  
  const financialMonthEnd = new Date(currentFinancialStart);
  financialMonthEnd.setMonth(financialMonthEnd.getMonth() + 1);
  financialMonthEnd.setDate(financialDayStart - 1);
  financialMonthEnd.setHours(23, 59, 59, 999);
  
  const currentDay = Math.ceil((currentDate.getTime() - currentFinancialStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysInMonth = Math.ceil((financialMonthEnd.getTime() - currentFinancialStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Filter transactions for current financial month
  const monthlyTransactions = useMemo(() => {
    return historicalTransactions.filter(tx => {
      const txDate = new Date(tx.time * 1000);
      return isExpense(tx, historicalTransactions) && 
             !excludedTransactionIds.includes(tx.id) &&
             txDate >= currentFinancialStart && txDate <= currentDate;
    });
  }, [historicalTransactions, excludedTransactionIds, currentFinancialStart, currentDate]);

  // Calculate totals
  const totalSpent = useMemo(() => {
    return monthlyTransactions.reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  }, [monthlyTransactions]);

  // Card balance for budget calculation
  const cardBalance = settings?.accountBalance || 0;
  const totalBudget = Math.abs(cardBalance); // Use current balance as budget reference

  // Calculate daily spends for analysis
  const dailySpends = useMemo(() => {
    const days = eachDayOfInterval({ start: currentFinancialStart, end: currentDate });
    return days.map(day => {
      const dayStart = new Date(day);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(day);
      dayEnd.setHours(23, 59, 59, 999);
      
      const dayTotal = monthlyTransactions
        .filter(tx => {
          const txDate = new Date(tx.time * 1000);
          return txDate >= dayStart && txDate <= dayEnd;
        })
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
      
      return { date: day, amount: dayTotal };
    });
  }, [monthlyTransactions, currentFinancialStart, currentDate]);

  // Recent daily spends (last 7 days)
  const recentDailySpends = useMemo(() => {
    return dailySpends.slice(-7).map(d => d.amount);
  }, [dailySpends]);

  // ============================================
  // COMPUTED STATISTICS
  // ============================================

  // Burn Rate Data
  const burnRateData = useMemo((): BurnRateData => {
    return calculateBurnRate(totalSpent, daysInMonth, currentDay, totalBudget, recentDailySpends);
  }, [totalSpent, daysInMonth, currentDay, totalBudget, recentDailySpends]);

  // KPI Data
  const kpiData = useMemo((): KPIData => {
    return calculateKPIs(totalSpent, totalBudget, dailySpends);
  }, [totalSpent, totalBudget, dailySpends]);

  // Day of Week Analysis
  const dayOfWeekAnalysis = useMemo((): DayOfWeekAnalysis[] => {
    return analyzeDayOfWeek(dailySpends, totalSpent);
  }, [dailySpends, totalSpent]);

  // Insights
  const insights = useMemo((): Insight[] => {
    return generateInsights(burnRateData, kpiData, [], dayOfWeekAnalysis);
  }, [burnRateData, kpiData, dayOfWeekAnalysis]);

  // Weekly pattern for chart
  const weeklyPatternData = useMemo(() => {
    const dayNames = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
    return dayOfWeekAnalysis.map((d, i) => ({
      day: dayNames[d.dayIndex],
      amount: d.averageAmount / 100,
      fullDay: d.dayName,
      isHighest: d.isHighest,
      isLowest: d.isLowest,
    }));
  }, [dayOfWeekAnalysis]);

  // Burn rate trend (last 7 days)
  const burnRateTrend = useMemo(() => {
    if (dailySpends.length < 2) return [];
    return dailySpends.slice(-7).map((d, i) => ({
      day: format(d.date, "EEE", { locale: uk }),
      spent: d.amount / 100,
      limit: burnRateData.dailyLimit / 100,
    }));
  }, [dailySpends, burnRateData.dailyLimit]);

  const isLoading = loadingHistory || externalLoading;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>📊</span>
              <span>Статистика</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => loadFromStorage()}
              disabled={isLoading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span className="ml-1.5 text-xs">{isLoading ? "..." : "Оновити"}</span>
            </Button>
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
      {/* BURN RATE DASHBOARD */}
      {/* ============================================ */}
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            <span>Burn Rate</span>
            <Badge variant={
              burnRateData.status === "critical" ? "destructive" :
              burnRateData.status === "warning" ? "secondary" : "default"
            } className="ml-auto">
              {burnRateData.status === "critical" ? "🔴 Критично" :
               burnRateData.status === "warning" ? "⚠️ Попередження" : "✅ Норма"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Burn Rate Gauge */}
          <div className="flex items-center justify-center mb-4">
            <div className="relative w-48 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  cx="50%"
                  cy="50%"
                  innerRadius="60%"
                  outerRadius="90%"
                  startAngle={180}
                  endAngle={0}
                  data={[{
                    name: "Burn Rate",
                    value: Math.min(burnRateData.burnRate, 150),
                    fill: burnRateData.status === "critical" ? "#ef4444" :
                          burnRateData.status === "warning" ? "#f97316" : "#22c55e",
                  }]}
                >
                  <RadialBar
                    background={{ fill: "#f3f4f6" }}
                    dataKey="value"
                    cornerRadius={20}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold">{burnRateData.burnRate}%</span>
                <span className="text-xs text-muted-foreground">використано</span>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <DollarSign className="w-4 h-4" />
                <span className="text-xs">Денний ліміт</span>
              </div>
              <p className="text-lg font-bold">
                {(burnRateData.dailyLimit / 100).toLocaleString("uk-UA")} ₴
              </p>
            </div>
            
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Minus className="w-4 h-4" />
                <span className="text-xs">Фактично/день</span>
              </div>
              <p className="text-lg font-bold">
                {(burnRateData.actualDailySpent / 100).toLocaleString("uk-UA")} ₴
              </p>
            </div>
            
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-xs">Залишилось днів</span>
              </div>
              <p className="text-lg font-bold">{burnRateData.daysRemaining}</p>
            </div>
            
            <div className={cn(
              "p-3 rounded-lg",
              burnRateData.projectedMonthEnd > totalBudget ? "bg-red-50" : "bg-green-50"
            )}>
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-4 h-4" />
                <span className="text-xs">Прогноз на кінець</span>
              </div>
              <p className={cn(
                "text-lg font-bold",
                burnRateData.projectedMonthEnd > totalBudget ? "text-red-600" : "text-green-600"
              )}>
                {(burnRateData.projectedMonthEnd / 100).toLocaleString("uk-UA")} ₴
              </p>
            </div>
          </div>

          {/* Trend Arrow */}
          <div className="mt-4 flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">Тренд:</span>
            {burnRateData.trend === "accelerating" ? (
              <span className="flex items-center gap-1 text-red-600 font-medium">
                <TrendingUp className="w-4 h-4" /> Прискорюється
              </span>
            ) : burnRateData.trend === "decelerating" ? (
              <span className="flex items-center gap-1 text-green-600 font-medium">
                <TrendingDown className="w-4 h-4" /> Сповільнюється
              </span>
            ) : (
              <span className="flex items-center gap-1 text-gray-600 font-medium">
                <Minus className="w-4 h-4" /> Стабільний
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* KPI CARDS */}
      {/* ============================================ */}

      <div className="grid grid-cols-2 gap-3">
        {/* Savings Rate */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Заощадження</span>
            </div>
            <p className={cn(
              "text-2xl font-bold",
              kpiData.savingsRate >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {kpiData.savingsRate >= 0 ? "+" : ""}{kpiData.savingsRate}%
            </p>
            <Progress 
              value={Math.max(0, Math.min(100, 50 + kpiData.savingsRate / 2))} 
              className="mt-2 h-1.5"
            />
          </CardContent>
        </Card>

        {/* Average Daily Spend */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Calendar className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Середнє/день</span>
            </div>
            <p className="text-2xl font-bold">
              {(kpiData.averageDailySpend / 100).toLocaleString("uk-UA")} ₴
            </p>
          </CardContent>
        </Card>

        {/* Best Day */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingDown className="w-4 h-4 text-green-500" />
              <span className="text-xs uppercase tracking-wider">Найкращий день</span>
            </div>
            <p className="text-lg font-bold">{kpiData.bestDay.day}</p>
            <p className="text-sm text-muted-foreground">
              {(kpiData.bestDay.amount / 100).toLocaleString("uk-UA")} ₴
            </p>
          </CardContent>
        </Card>

        {/* Worst Day */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4 text-red-500" />
              <span className="text-xs uppercase tracking-wider">Найгірший день</span>
            </div>
            <p className="text-lg font-bold">{kpiData.worstDay.day}</p>
            <p className="text-sm text-muted-foreground">
              {(kpiData.worstDay.amount / 100).toLocaleString("uk-UA")} ₴
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ============================================ */}
      {/* DAY OF WEEK ANALYSIS */}
      {/* ============================================ */}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            <span>Аналіз по днях тижня</span>
            {dayOfWeekAnalysis.find(d => d.isHighest) && (
              <Badge variant="outline" className="ml-auto text-xs">
                🔥 Найдорожчий: {dayOfWeekAnalysis.find(d => d.isHighest)?.dayName}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyPatternData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="day" 
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                />
                <YAxis 
                  tick={{ fontSize: 11 }}
                  stroke="#9ca3af"
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: number): [string, string] => [
                    `${value.toLocaleString("uk-UA")} ₴`,
                    "Середнє"
                  ]}
                  labelFormatter={(label: string) => {
                    const item = weeklyPatternData.find(d => d.day === label);
                    return item?.fullDay || label;
                  }}
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: "8px",
                  }}
                />
                <Bar
                  dataKey="amount"
                  radius={[4, 4, 0, 0]}
                  fill="#6366f1"
                >
                  {weeklyPatternData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isHighest ? "#ef4444" : entry.isLowest ? "#22c55e" : "#6366f1"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Day Summary */}
          <div className="mt-3 grid grid-cols-7 gap-1 text-center">
            {dayOfWeekAnalysis.map((day) => (
              <div
                key={day.dayIndex}
                className={cn(
                  "p-2 rounded-lg text-xs",
                  day.isHighest ? "bg-red-100 text-red-700 font-bold" :
                  day.isLowest ? "bg-green-100 text-green-700" :
                  "bg-muted/50"
                )}
              >
                <div className="text-[10px] text-muted-foreground">
                  {day.dayName.substring(0, 2)}
                </div>
                <div className="font-medium mt-0.5">
                  {day.percentageOfTotal.toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* AUTO-INSIGHTS PANEL */}
      {/* ============================================ */}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-500" />
            <span>Авто-інсайти</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {insights.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Недостатньо даних для аналізу</p>
              </div>
            ) : (
              insights.map((insight) => (
                <div
                  key={insight.id}
                  className={cn(
                    "p-3 rounded-lg border-l-4",
                    insight.severity === "alert" ? "border-l-red-500 bg-red-50" :
                    insight.severity === "warning" ? "border-l-orange-500 bg-orange-50" :
                    "border-l-blue-500 bg-blue-50"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xl">{insight.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{insight.message}</p>
                      {insight.recommendation && (
                        <p className="text-xs text-muted-foreground mt-1">
                          💡 {insight.recommendation}
                        </p>
                      )}
                    </div>
                    {insight.severity === "alert" ? (
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    ) : insight.severity === "warning" ? (
                      <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* ============================================ */}
      {/* BURN RATE TREND CHART */}
      {/* ============================================ */}

      {burnRateTrend.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              <span>Burn Rate (7 днів)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={burnRateTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fontSize: 11 }}
                    stroke="#9ca3af"
                  />
                  <YAxis 
                    tick={{ fontSize: 11 }}
                    stroke="#9ca3af"
                    tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `${value.toLocaleString("uk-UA")} ₴`,
                      name === "spent" ? "Витрачено" : "Ліміт"
                    ]}
                    contentStyle={{
                      backgroundColor: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="spent"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ fill: "#ef4444", strokeWidth: 2, r: 4 }}
                    name="Витрачено"
                  />
                  <Line
                    type="monotone"
                    dataKey="limit"
                    stroke="#22c55e"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    name="Ліміт"
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
