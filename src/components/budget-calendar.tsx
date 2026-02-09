"use client";

import { useCallback, useMemo } from "react";
import { format, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { uk } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Check, AlertTriangle, XCircle } from "lucide-react";
import { DayBudget, Transaction } from "@/types";
import { cn } from "@/lib/utils";
import { useBudgetStore } from "@/store/budget-store";
import { isExpense, getFinancialMonthStart, getFinancialMonthEnd, isSameFinancialMonth } from "@/lib/monobank";

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getFinancialMonthLabel(date: Date, financialDayStart: number): string {
  const start = getFinancialMonthStart(date, financialDayStart);
  const end = getFinancialMonthEnd(date, financialDayStart);

  const startMonth = capitalizeFirst(format(start, "MMMM", { locale: uk }));
  const endMonth = capitalizeFirst(format(end, "MMMM", { locale: uk }));
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startDay} - ${endDay} ${startMonth}`;
  } else {
    return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
  }
}

interface BudgetCalendarProps {
  dailyLimits: DayBudget[];
  onDayClick?: (day: DayBudget) => void;
  selectedMonth: Date;
  onMonthChange: (month: Date) => void;
}

export function BudgetCalendar({ dailyLimits, onDayClick, selectedMonth, onMonthChange }: BudgetCalendarProps) {
  const { transactions, excludedTransactionIds, settings } = useBudgetStore();
  const financialDayStart = settings.financialMonthStart || 1;

  // Create stable Set reference for excludedTransactionIds to avoid React Compiler memoization issues
  const excludedIdSet = useMemo(() => 
    new Set(excludedTransactionIds), 
    [excludedTransactionIds]
  );

  const isCurrentFinancialMonth = isSameFinancialMonth(selectedMonth, new Date(), financialDayStart);
  
  // Use financial month calculations
  const financialMonthStart = getFinancialMonthStart(selectedMonth, financialDayStart);
  const financialMonthEnd = getFinancialMonthEnd(selectedMonth, financialDayStart);

  // For calendar grid, we need to show all days from financial month start to end
  // This ensures we show the correct range (e.g., Dec 5 - Jan 4)
  const calendarDays = eachDayOfInterval({ start: financialMonthStart, end: financialMonthEnd });

  const firstDayOfWeek = financialMonthStart.getDay();
  const paddingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
  
  const goToPreviousMonth = useCallback(() => {
    // Go back by one financial month
    const currentStart = getFinancialMonthStart(selectedMonth, financialDayStart);
    const newDate = new Date(currentStart);
    newDate.setDate(newDate.getDate() - 1); // Go to day before current financial month starts
    // Ensure we get the correct financial month for this date
    const newFinancialMonthStart = getFinancialMonthStart(newDate, financialDayStart);
    onMonthChange(newFinancialMonthStart);
  }, [selectedMonth, financialDayStart, onMonthChange]);

  const goToNextMonth = useCallback(() => {
    // Go forward by one financial month
    const currentEnd = getFinancialMonthEnd(selectedMonth, financialDayStart);
    const newDate = new Date(currentEnd);
    newDate.setDate(newDate.getDate() + 1); // Go to day after current financial month ends
    // Ensure we get the correct financial month for this date
    const newFinancialMonthStart = getFinancialMonthStart(newDate, financialDayStart);
    onMonthChange(newFinancialMonthStart);
  }, [selectedMonth, financialDayStart, onMonthChange]);

  const goToCurrentMonth = useCallback(() => {
    onMonthChange(getFinancialMonthStart(new Date(), financialDayStart));
  }, [financialDayStart, onMonthChange]);

  const financialMonthLabel = getFinancialMonthLabel(selectedMonth, financialDayStart);

  // Calculate daily data from transactions (for both current and historical months)
  const historicalDailyData = useMemo(() => {
    const dataMap = new Map<string, { spent: number; transactions: Transaction[] }>();
    
    transactions.forEach(tx => {
      const txDate = new Date(tx.time * 1000);
      // Check if transaction is within the financial month range
      if (txDate < financialMonthStart || txDate > financialMonthEnd) return;
      if (!isExpense(tx, transactions)) return;
      if (excludedIdSet.has(tx.id)) return;
      
      const dateKey = format(txDate, "yyyy-MM-dd");
      const existing = dataMap.get(dateKey) || { spent: 0, transactions: [] };
      existing.spent += Math.abs(tx.amount);
      existing.transactions.push(tx);
      dataMap.set(dateKey, existing);
    });
    
    return dataMap;
  }, [transactions, financialMonthStart, financialMonthEnd, excludedIdSet]);

  // Calculate average daily limit for historical months
  const avgDailyLimit = useMemo(() => {
    if (isCurrentFinancialMonth && dailyLimits.length > 0) {
      const total = dailyLimits.reduce((sum, d) => sum + d.limit, 0);
      return total / dailyLimits.length;
    }
    // For historical months, use balance / 30 as rough estimate
    return (settings.accountBalance || 0) / 30;
  }, [isCurrentFinancialMonth, dailyLimits, settings.accountBalance]);

  // Get status color for the bar fill - softer, less aggressive palette
  const getStatusColor = (percentage: number): string => {
    if (percentage >= 100) return "bg-rose-300";      // soft rose instead of aggressive red
    if (percentage >= 80) return "bg-amber-300";      // soft amber
    if (percentage >= 50) return "bg-yellow-200";     // very soft yellow
    return "bg-teal-200";                              // soft teal instead of bright green
  };

  // A11Y-001: Get status text for screen readers
  const getStatusText = (percentage: number): string => {
    if (percentage >= 100) return "перевищено ліміт";
    if (percentage >= 80) return "близько до ліміту";
    if (percentage >= 50) return "помірні витрати";
    return "в межах бюджету";
  };

  // A11Y-002: Get status icon for colorblind users
  const getStatusIcon = (percentage: number) => {
    if (percentage >= 100) return <XCircle className="w-2.5 h-2.5 text-red-600" aria-hidden="true" />;
    if (percentage >= 80) return <AlertTriangle className="w-2.5 h-2.5 text-amber-600" aria-hidden="true" />;
    return null; // No icon for normal status to reduce visual noise
  };

  // Get day info - either from current month dailyLimits or historical data
  const getDayInfo = (day: Date): { spent: number; limit: number; percentage: number; transactions: Transaction[] } | null => {
    const dateKey = format(day, "yyyy-MM-dd");
    
    if (isCurrentFinancialMonth) {
      // For current month, prefer dailyLimits, but fall back to historical transactions if not found
      const dayData = dailyLimits.find((d) => isSameDay(d.date, day));
      if (dayData) {
        const percentage = dayData.limit > 0 ? (dayData.spent / dayData.limit) * 100 : 0;
        return { spent: dayData.spent, limit: dayData.limit, percentage, transactions: dayData.transactions };
      }
      
      // If no data in dailyLimits, use historical transactions
      const histData = historicalDailyData?.get(dateKey);
      if (histData) {
        const spent = histData.spent;
        const limit = avgDailyLimit;
        const percentage = limit > 0 ? (spent / limit) * 100 : 0;
        return { spent, limit, percentage, transactions: histData.transactions };
      }
      
      // If no data at all, return null
      return null;
    } else {
      // For historical months, use historical data only
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
    
    if (isCurrentFinancialMonth) {
      totalSpent = dailyLimits.reduce((sum, d) => sum + d.spent, 0);
    } else if (historicalDailyData) {
      historicalDailyData.forEach(data => {
        totalSpent += data.spent;
      });
    }
    
    return { spent: totalSpent };
  }, [isCurrentFinancialMonth, dailyLimits, historicalDailyData]);

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
            !isCurrentFinancialMonth && "hover:opacity-70 cursor-pointer"
          )}
        >
          <span className="text-lg font-medium tracking-normal text-foreground">
            {financialMonthLabel}
          </span>
          <span className="text-xs text-muted-foreground">
            {financialMonthStart.getFullYear() !== financialMonthEnd.getFullYear()
              ? `${financialMonthStart.getFullYear()} - ${financialMonthEnd.getFullYear()}`
              : format(financialMonthStart, "yyyy")}
          </span>
        </button>
        
        <button
          onClick={goToNextMonth}
          disabled={isCurrentFinancialMonth}
          className={cn(
            "p-2 -mr-2 rounded-full transition-all",
            isCurrentFinancialMonth 
              ? "opacity-30 cursor-not-allowed" 
              : "hover:bg-muted/50 active:scale-95"
          )}
          aria-label="Наступний місяць"
        >
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Weekday headers */}
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

      {/* Calendar grid with color fill from bottom */}
      <div className="grid grid-cols-7 gap-1 md:gap-1.5">
        {Array.from({ length: paddingDays }).map((_, i) => (
          <div key={`padding-${i}`} className="h-14 md:h-20" />
        ))}

        {calendarDays.map((day) => {
          // All days in calendarDays are already within the financial month
          const dayInfo = getDayInfo(day);
          const isTodayDay = isToday(day);
          const isPast = day < new Date() && !isTodayDay;
          const hasSpending = dayInfo && dayInfo.spent > 0;
          const barHeight = dayInfo ? Math.min((dayInfo.spent / dayInfo.limit) * 100, 100) : 0;

          // A11Y-001: Generate accessible label for screen readers
          const dateLabel = format(day, "EEEE, d MMMM", { locale: uk });
          const spentLabel = dayInfo && dayInfo.spent > 0
            ? `витрачено ${(dayInfo.spent / 100).toLocaleString("uk-UA")} з ${(dayInfo.limit / 100).toLocaleString("uk-UA")} гривень`
            : dayInfo ? `ліміт ${(dayInfo.limit / 100).toLocaleString("uk-UA")} гривень` : "";
          const statusLabel = dayInfo ? getStatusText(dayInfo.percentage) : "";
          const ariaLabel = `${dateLabel}${isTodayDay ? ", сьогодні" : ""}. ${spentLabel}${statusLabel ? `, ${statusLabel}` : ""}`;

          return (
            <button
              key={day.toISOString()}
              aria-label={ariaLabel}
              onClick={() => {
                if (dayInfo) {
                  // Create DayBudget object for historical months too
                  const dayData: DayBudget = {
                    date: day,
                    limit: dayInfo.limit,
                    spent: dayInfo.spent,
                    remaining: dayInfo.limit - dayInfo.spent,
                    transactions: dayInfo.transactions,
                    status: dayInfo.percentage >= 100 ? "over" : dayInfo.percentage >= 80 ? "warning" : "under"
                  };
                  onDayClick?.(dayData);
                }
              }}
              className={cn(
                "relative h-14 md:h-20 rounded-md md:rounded-lg border overflow-hidden transition-all active:scale-95 md:hover:shadow-md md:hover:border-primary/50",
                isTodayDay && "ring-2 ring-primary ring-offset-1",
                dayInfo?.percentage && dayInfo.percentage >= 100 && "border-red-300",
                isPast && !hasSpending && dayInfo && "bg-gray-100",
                !isPast && !hasSpending && dayInfo && "bg-card"
              )}
            >
              {/* Color fill from bottom */}
              <div className="absolute inset-0">
                <div
                  className={cn(
                    "absolute bottom-0 left-0 right-0 transition-all duration-300",
                    isPast && !hasSpending ? "bg-gray-100" : getStatusColor(dayInfo?.percentage || 0)
                  )}
                  style={{ height: isPast && !hasSpending ? "0%" : `${barHeight}%` }}
                />

                <div className="relative z-10 p-1 md:p-1.5 flex flex-col h-full">
                  <div className="flex items-center gap-0.5 md:gap-1">
                    <span
                      className={cn(
                        "text-xs md:text-sm font-medium",
                        isTodayDay ? "text-primary font-bold" : "text-foreground/80"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {isTodayDay && (
                      <span className="w-1 h-1 md:w-1.5 md:h-1.5 rounded-full bg-primary animate-pulse" />
                    )}
                    {/* A11Y-002: Status icon for colorblind users */}
                    {dayInfo && hasSpending && getStatusIcon(dayInfo.percentage)}
                  </div>

                  {dayInfo && (
                    <div className="mt-auto">
                      {dayInfo.spent > 0 ? (
                        <>
                          <div className="text-[10px] md:text-xs font-semibold text-foreground/70 leading-tight">
                            {(dayInfo.spent / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
                          </div>
                          <div className="text-[9px] md:text-[10px] text-muted-foreground leading-tight">
                            /{(dayInfo.limit / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
                          </div>
                        </>
                      ) : (
                        <div className="text-[9px] md:text-[10px] text-muted-foreground leading-tight">
                          {(dayInfo.limit / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-3 md:gap-6 mt-3 md:mt-4 overflow-x-auto px-2">
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded bg-teal-200" />
          <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap">&lt;50%</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded bg-yellow-200" />
          <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap">50-80%</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded bg-amber-300" />
          <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap">80-100%</span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded bg-rose-300" />
          <span className="text-[10px] md:text-xs text-muted-foreground whitespace-nowrap">&gt;100%</span>
        </div>
      </div>
    </div>
  );
}
