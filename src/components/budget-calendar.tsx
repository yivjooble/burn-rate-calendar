"use client";

import { useState, useCallback, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths, isSameMonth } from "date-fns";
import { uk } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayBudget, Transaction } from "@/types";
import { cn } from "@/lib/utils";
import { useBudgetStore } from "@/store/budget-store";
import { isExpense } from "@/lib/monobank";

interface BudgetCalendarProps {
  dailyLimits: DayBudget[];
  onDayClick?: (day: DayBudget) => void;
}

export function BudgetCalendar({ dailyLimits, onDayClick }: BudgetCalendarProps) {
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const { transactions, excludedTransactionIds, settings } = useBudgetStore();
  
  const isCurrentMonth = isSameMonth(selectedMonth, new Date());
  
  const monthStart = startOfMonth(selectedMonth);
  const monthEnd = endOfMonth(selectedMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const firstDayOfWeek = monthStart.getDay();
  const paddingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
  
  const goToPreviousMonth = useCallback(() => {
    setSelectedMonth(prev => subMonths(prev, 1));
  }, []);
  
  const goToNextMonth = useCallback(() => {
    setSelectedMonth(prev => addMonths(prev, 1));
  }, []);
  
  const goToCurrentMonth = useCallback(() => {
    setSelectedMonth(new Date());
  }, []);

  // Calculate daily data for historical months from transactions
  const historicalDailyData = useMemo(() => {
    if (isCurrentMonth) return null;
    
    const dataMap = new Map<string, { spent: number; transactions: Transaction[] }>();
    
    transactions.forEach(tx => {
      const txDate = new Date(tx.time * 1000);
      if (!isSameMonth(txDate, selectedMonth)) return;
      if (!isExpense(tx, transactions)) return;
      if (excludedTransactionIds.includes(tx.id)) return;
      
      const dateKey = format(txDate, "yyyy-MM-dd");
      const existing = dataMap.get(dateKey) || { spent: 0, transactions: [] };
      existing.spent += Math.abs(tx.amount);
      existing.transactions.push(tx);
      dataMap.set(dateKey, existing);
    });
    
    return dataMap;
  }, [transactions, selectedMonth, isCurrentMonth, excludedTransactionIds]);

  // Calculate average daily limit for historical months
  const avgDailyLimit = useMemo(() => {
    if (isCurrentMonth && dailyLimits.length > 0) {
      const total = dailyLimits.reduce((sum, d) => sum + d.limit, 0);
      return total / dailyLimits.length;
    }
    // For historical months, use balance / 30 as rough estimate
    return (settings.accountBalance || 0) / 30;
  }, [isCurrentMonth, dailyLimits, settings.accountBalance]);

  // Get status color for the indicator dot
  const getStatusColor = (percentage: number): string => {
    if (percentage >= 100) return "bg-red-500";
    if (percentage >= 80) return "bg-amber-500";
    if (percentage >= 50) return "bg-yellow-400";
    return "bg-emerald-500";
  };

  // Get day info - either from current month dailyLimits or historical data
  const getDayInfo = (day: Date): { spent: number; limit: number; percentage: number; transactions: Transaction[] } | null => {
    if (isCurrentMonth) {
      const dayData = dailyLimits.find((d) => isSameDay(d.date, day));
      if (!dayData) return null;
      const percentage = dayData.limit > 0 ? (dayData.spent / dayData.limit) * 100 : 0;
      return { spent: dayData.spent, limit: dayData.limit, percentage, transactions: dayData.transactions };
    } else {
      const dateKey = format(day, "yyyy-MM-dd");
      const histData = historicalDailyData?.get(dateKey);
      const spent = histData?.spent || 0;
      const limit = avgDailyLimit;
      const percentage = limit > 0 ? (spent / limit) * 100 : 0;
      return { spent, limit, percentage, transactions: histData?.transactions || [] };
    }
  };

  // Calculate month totals
  const monthTotals = useMemo(() => {
    let totalSpent = 0;
    
    if (isCurrentMonth) {
      totalSpent = dailyLimits.reduce((sum, d) => sum + d.spent, 0);
    } else if (historicalDailyData) {
      historicalDailyData.forEach(data => {
        totalSpent += data.spent;
      });
    }
    
    return { spent: totalSpent };
  }, [isCurrentMonth, dailyLimits, historicalDailyData]);

  return (
    <div className="w-full space-y-4">
      {/* Month Navigation - Minimalist */}
      <div className="flex items-center justify-between">
        <button
          onClick={goToPreviousMonth}
          className="p-2 -ml-2 rounded-full hover:bg-muted/50 active:scale-95 transition-all"
          aria-label="Попередній місяць"
        >
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        
        <button 
          onClick={goToCurrentMonth}
          className={cn(
            "flex flex-col items-center transition-all",
            !isCurrentMonth && "hover:opacity-70 cursor-pointer"
          )}
        >
          <span className="text-xl font-light tracking-tight capitalize">
            {format(selectedMonth, "LLLL", { locale: uk })}
          </span>
          <span className="text-xs text-muted-foreground font-medium">
            {format(selectedMonth, "yyyy")}
          </span>
        </button>
        
        <button
          onClick={goToNextMonth}
          disabled={isCurrentMonth}
          className={cn(
            "p-2 -mr-2 rounded-full transition-all",
            isCurrentMonth 
              ? "opacity-30 cursor-not-allowed" 
              : "hover:bg-muted/50 active:scale-95"
          )}
          aria-label="Наступний місяць"
        >
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Month Summary - Glassmorphism style */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-xs text-white/60 uppercase tracking-wider">Витрачено</p>
            <p className="text-2xl font-light tracking-tight">
              {(monthTotals.spent / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
              <span className="text-base text-white/60 ml-1">₴</span>
            </p>
          </div>
          {isCurrentMonth && (
            <div className="text-right">
              <p className="text-xs text-white/60 uppercase tracking-wider">На день</p>
              <p className="text-2xl font-light tracking-tight">
                {(avgDailyLimit / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
                <span className="text-base text-white/60 ml-1">₴</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Weekday headers - Minimal */}
      <div className="grid grid-cols-7 gap-0.5">
        {weekDays.map((day, i) => (
          <div
            key={day}
            className={cn(
              "text-center text-[11px] font-medium py-2",
              i >= 5 ? "text-muted-foreground/60" : "text-muted-foreground"
            )}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid - Minimalist design */}
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: paddingDays }).map((_, i) => (
          <div key={`padding-${i}`} className="aspect-square" />
        ))}

        {days.map((day) => {
          const dayInfo = getDayInfo(day);
          const isTodayDay = isToday(day);
          const isPast = day < new Date() && !isTodayDay;
          const hasSpending = dayInfo && dayInfo.spent > 0;

          return (
            <button
              key={day.toISOString()}
              onClick={() => {
                if (isCurrentMonth) {
                  const dayData = dailyLimits.find((d) => isSameDay(d.date, day));
                  if (dayData) onDayClick?.(dayData);
                }
              }}
              className={cn(
                "relative aspect-square flex flex-col items-center justify-center rounded-xl transition-all",
                "active:scale-95",
                isTodayDay && "bg-slate-900 text-white shadow-lg",
                !isTodayDay && isPast && !hasSpending && "opacity-40",
                !isTodayDay && "hover:bg-muted/50"
              )}
            >
              {/* Day number */}
              <span
                className={cn(
                  "text-base font-light",
                  isTodayDay ? "font-medium" : "text-foreground/80"
                )}
              >
                {format(day, "d")}
              </span>

              {/* Spending amount - small, below number */}
              {hasSpending && (
                <span className={cn(
                  "text-[10px] tabular-nums",
                  isTodayDay ? "text-white/70" : "text-muted-foreground"
                )}>
                  {(dayInfo.spent / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
                </span>
              )}

              {/* Status indicator - thin line at bottom */}
              {hasSpending && (
                <div 
                  className={cn(
                    "absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 rounded-full transition-all",
                    getStatusColor(dayInfo.percentage)
                  )}
                  style={{ width: `${Math.min(dayInfo.percentage, 100) * 0.6}%`, minWidth: hasSpending ? 8 : 0 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend - Compact, subtle */}
      <div className="flex justify-center gap-4 pt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] text-muted-foreground">норма</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded-full bg-amber-500" />
          <span className="text-[10px] text-muted-foreground">увага</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded-full bg-red-500" />
          <span className="text-[10px] text-muted-foreground">перевитрата</span>
        </div>
      </div>
    </div>
  );
}
