"use client";

import { MonthBudget } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingDown, Calendar, Lightbulb, Archive } from "lucide-react";

interface BudgetSummaryProps {
  budget: MonthBudget;
}

export function BudgetSummary({ budget }: BudgetSummaryProps) {
  const isHistorical = budget.isHistorical ?? false;

  // Use current card balance for daily limit (what you can actually spend per day)
  // Falls back to totalRemaining if currentBalance is not available
  const availableForDaily = budget.currentBalance ?? budget.totalRemaining;
  const dailyBudget = budget.daysRemaining > 0
    ? Math.max(0, availableForDaily) / budget.daysRemaining
    : 0;

  // For historical months, use the stored daily average (average spent per day)
  const displayDailyAmount = isHistorical
    ? (budget.dailyAverage ?? 0)
    : dailyBudget;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card className={`py-0 ${isHistorical ? 'bg-muted/30' : ''}`}>
          <CardContent className="p-2 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Wallet className="w-3.5 h-3.5" />
              <span className="text-xs">{isHistorical ? "Всього лімітів" : "Бюджет"}</span>
            </div>
            <div className={`text-base font-bold ${isHistorical ? 'text-muted-foreground' : ''}`}>
              {(budget.totalBudget / 100).toLocaleString("uk-UA")} ₴
            </div>
          </CardContent>
        </Card>

        <Card className={`py-0 ${isHistorical ? 'bg-muted/30' : ''}`}>
          <CardContent className="p-2 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingDown className="w-3.5 h-3.5" />
              <span className="text-xs">Витрачено</span>
            </div>
            <div className={`text-base font-bold ${isHistorical ? 'text-muted-foreground' : 'text-red-500'}`}>
              {(budget.totalSpent / 100).toLocaleString("uk-UA")} ₴
            </div>
          </CardContent>
        </Card>

        <Card className={`py-0 ${isHistorical ? 'bg-muted/30' : ''}`}>
          <CardContent className="p-2 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              {isHistorical ? (
                <Archive className="w-3.5 h-3.5" />
              ) : (
                <Calendar className="w-3.5 h-3.5" />
              )}
              <span className="text-xs">{isHistorical ? "Статус" : "Днів залишилось"}</span>
            </div>
            <div className="text-base font-bold">
              {isHistorical ? (
                <span className="text-muted-foreground">Завершено</span>
              ) : (
                budget.daysRemaining
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={`py-0 ${isHistorical ? 'bg-muted/30' : ''}`}>
          <CardContent className="p-2 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Lightbulb className="w-3.5 h-3.5" />
              <span className="text-xs">{isHistorical ? "В середньому" : "На день"}</span>
            </div>
            <div className={`text-base font-bold ${isHistorical ? 'text-muted-foreground' : displayDailyAmount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {(displayDailyAmount / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴
              {isHistorical && <span className="text-xs font-normal ml-1">/день</span>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
