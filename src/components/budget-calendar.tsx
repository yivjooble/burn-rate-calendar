"use client";

import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";
import { uk } from "date-fns/locale";
import { DayBudget } from "@/types";
import { cn } from "@/lib/utils";

interface BudgetCalendarProps {
  dailyLimits: DayBudget[];
  onDayClick?: (day: DayBudget) => void;
}

export function BudgetCalendar({ dailyLimits, onDayClick }: BudgetCalendarProps) {
  const currentDate = new Date();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const firstDayOfWeek = monthStart.getDay();
  const paddingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

  const getDayData = (date: Date): DayBudget | undefined => {
    return dailyLimits.find((d) => isSameDay(d.date, date));
  };

  const getBarHeight = (dayData: DayBudget): number => {
    if (dayData.limit === 0) return 0;
    const percentage = Math.min((dayData.spent / dayData.limit) * 100, 100);
    return percentage;
  };

  const getBarColor = (dayData: DayBudget): string => {
    const percentage = dayData.limit > 0 ? (dayData.spent / dayData.limit) * 100 : 0;
    
    if (percentage >= 100) return "bg-red-400";
    if (percentage >= 80) return "bg-orange-400";
    if (percentage >= 50) return "bg-yellow-400";
    return "bg-emerald-400";
  };

  return (
    <div className="w-full">
      <h2 className="text-base font-semibold text-center mb-3">
        {format(currentDate, "LLLL yyyy", { locale: uk })}
      </h2>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid - compact cells */}
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: paddingDays }).map((_, i) => (
          <div key={`padding-${i}`} className="h-16 sm:h-20" />
        ))}

        {days.map((day) => {
          const dayData = getDayData(day);
          const barHeight = dayData ? getBarHeight(dayData) : 0;
          const barColor = dayData ? getBarColor(dayData) : "bg-gray-100";
          
          // Check if this is a past day with no spending (not today)
          const isPastWithNoSpending = !isToday(day) && day < new Date() && dayData && dayData.spent === 0;

          return (
            <button
              key={day.toISOString()}
              onClick={() => dayData && onDayClick?.(dayData)}
              className={cn(
                "relative h-16 sm:h-20 rounded-lg border overflow-hidden transition-all hover:shadow-md hover:border-primary/50",
                isToday(day) && "ring-2 ring-primary ring-offset-1",
                dayData?.status === "over" && "border-red-300",
                isPastWithNoSpending ? "bg-gray-200" : "bg-card"
              )}
            >
              <div className="absolute inset-0">
                <div
                  className={cn(
                    "absolute bottom-0 left-0 right-0 transition-all duration-300",
                    isPastWithNoSpending ? "bg-gray-200" : barColor
                  )}
                  style={{ height: isPastWithNoSpending ? "0%" : `${barHeight}%` }}
                />

                <div className="relative z-10 p-1.5 flex flex-col h-full">
                  <div className="flex items-center gap-1">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        isToday(day) ? "text-primary font-bold" : "text-foreground/80"
                      )}
                    >
                      {format(day, "d")}
                    </span>
                    {isToday(day) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>

                  {dayData && (
                    <div className="mt-auto">
                      {dayData.spent > 0 ? (
                        <>
                          <div className="text-xs font-semibold text-foreground/70">
                            {(dayData.spent / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            /{(dayData.limit / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
                          </div>
                        </>
                      ) : (
                        <div className="text-[10px] text-muted-foreground">
                          {(dayData.limit / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })}
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
      <div className="flex justify-center gap-6 mt-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-emerald-400" />
          <span className="text-xs text-muted-foreground">&lt;50%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-400" />
          <span className="text-xs text-muted-foreground">50-80%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-400" />
          <span className="text-xs text-muted-foreground">80-100%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-400" />
          <span className="text-xs text-muted-foreground">&gt;100%</span>
        </div>
      </div>
    </div>
  );
}
