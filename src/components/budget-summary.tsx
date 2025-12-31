"use client";

import { MonthBudget } from "@/types";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingDown, Calendar, Lightbulb } from "lucide-react";

interface BudgetSummaryProps {
  budget: MonthBudget;
}

export function BudgetSummary({ budget }: BudgetSummaryProps) {
  const percentSpent = (budget.totalSpent / budget.totalBudget) * 100;
  // Use current card balance for daily limit (what you can actually spend per day)
  // Falls back to totalRemaining if currentBalance is not available
  const availableForDaily = budget.currentBalance ?? budget.totalRemaining;
  const dailyAverage = budget.daysRemaining > 0
    ? Math.max(0, availableForDaily) / budget.daysRemaining
    : 0;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card className="py-0">
          <CardContent className="p-2 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Wallet className="w-3.5 h-3.5" />
              <span className="text-xs">Бюджет</span>
            </div>
            <div className="text-base font-bold">
              {(budget.totalBudget / 100).toLocaleString("uk-UA")} ₴
            </div>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardContent className="p-2 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingDown className="w-3.5 h-3.5" />
              <span className="text-xs">Витрачено</span>
            </div>
            <div className="text-base font-bold text-red-500">
              {(budget.totalSpent / 100).toLocaleString("uk-UA")} ₴
            </div>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardContent className="p-2 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-xs">Днів залишилось</span>
            </div>
            <div className="text-base font-bold">{budget.daysRemaining}</div>
          </CardContent>
        </Card>

        <Card className="py-0">
          <CardContent className="p-2 flex flex-col items-center justify-center text-center">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Lightbulb className="w-3.5 h-3.5" />
              <span className="text-xs">На день</span>
            </div>
            <div className={`text-base font-bold ${dailyAverage >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {(dailyAverage / 100).toLocaleString("uk-UA", { maximumFractionDigits: 0 })} ₴
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="py-0">
        <CardContent className="p-3">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-muted-foreground">Прогрес витрат</span>
            <span className={`font-bold ${percentSpent > 100 ? 'text-red-500' : percentSpent > 80 ? 'text-orange-500' : 'text-emerald-600'}`}>
              {percentSpent.toFixed(0)}%
            </span>
          </div>
          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className={`absolute left-0 top-0 h-full transition-all rounded-full ${
                percentSpent > 100 ? 'bg-red-500' : percentSpent > 80 ? 'bg-orange-400' : percentSpent > 50 ? 'bg-yellow-400' : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(percentSpent, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>0 ₴</span>
            <span className={`font-semibold ${budget.totalRemaining >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              Залишок: {(budget.totalRemaining / 100).toLocaleString("uk-UA")} ₴
            </span>
            <span>{(budget.totalBudget / 100).toLocaleString("uk-UA")} ₴</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
