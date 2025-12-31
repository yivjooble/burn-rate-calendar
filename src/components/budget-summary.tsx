"use client";

import { MonthBudget } from "@/types";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, TrendingDown, Calendar, Lightbulb } from "lucide-react";

interface BudgetSummaryProps {
  budget: MonthBudget;
}

export function BudgetSummary({ budget }: BudgetSummaryProps) {
  // Progress based on days passed in month
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysPassed = today.getDate();
  const percentMonthPassed = (daysPassed / daysInMonth) * 100;
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
            <span className="text-muted-foreground">Прогрес місяця</span>
            <span className="font-bold text-slate-600">
              {daysPassed} / {daysInMonth} днів
            </span>
          </div>
          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className="absolute left-0 top-0 h-full transition-all rounded-full bg-slate-400"
              style={{ width: `${percentMonthPassed}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>1 день</span>
            <span className="font-medium">
              Залишилось {budget.daysRemaining} {budget.daysRemaining === 1 ? 'день' : budget.daysRemaining < 5 ? 'дні' : 'днів'}
            </span>
            <span>{daysInMonth} днів</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
