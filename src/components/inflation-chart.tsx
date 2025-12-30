"use client";

import { InflationPrediction } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";

interface InflationChartProps {
  prediction: InflationPrediction;
}

export function InflationChart({ prediction }: InflationChartProps) {
  const maxBalance = Math.max(...prediction.yearlyProjection.map((p) => p.balance), 1);

  const getStatusInfo = () => {
    if (prediction.monthsUntilZero <= 3) {
      return {
        icon: AlertTriangle,
        color: "text-red-500",
        bgColor: "bg-red-50",
        message: "Критичний рівень! Потрібно скоротити витрати.",
      };
    }
    if (prediction.monthsUntilZero <= 6) {
      return {
        icon: TrendingDown,
        color: "text-orange-500",
        bgColor: "bg-orange-50",
        message: "Увага! Баланс знизиться до нуля за пів року.",
      };
    }
    return {
      icon: CheckCircle,
      color: "text-emerald-500",
      bgColor: "bg-emerald-50",
      message: "Стабільний burn rate. Продовжуйте в тому ж дусі!",
    };
  };

  const status = getStatusInfo();
  const StatusIcon = status.icon;

  const hasData = prediction.currentBalance > 0 || prediction.monthlyBurnRate !== 0;

  return (
    <div className="space-y-3">
      <Card className="bg-blue-50 border-blue-200 py-0">
        <CardContent className="p-3">
          <div className="flex items-start gap-2">
            <HelpCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Що показує цей прогноз?</p>
              <ul className="list-disc list-inside text-sm">
                <li><strong>Місячний burn rate</strong> — середня різниця між витратами та доходами за місяць</li>
                <li><strong>Місяців до нуля</strong> — скільки місяців залишиться до вичерпання балансу при поточному темпі</li>
                <li><strong>Графік</strong> — прогнозований баланс рахунку на кожен місяць наступного року</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {!hasData && (
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-orange-700">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm">Немає даних для прогнозу. Підключіть Monobank та оновіть дані.</span>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2 pt-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span>Прогноз балансу на рік</span>
            <Badge variant="outline" className="font-normal">
              Точність: {(prediction.confidence * 100).toFixed(0)}%
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`p-2 rounded-lg ${status.bgColor} mb-3`}>
            <div className="flex items-center gap-2">
              <StatusIcon className={`w-4 h-4 ${status.color}`} />
              <span className="text-sm font-medium">{status.message}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="text-center p-2 bg-muted rounded-lg">
              <div className="text-xl font-bold">
                {prediction.monthlyBurnRate >= 0 ? "" : "-"}
                {Math.abs(prediction.monthlyBurnRate / 100).toLocaleString("uk-UA")} ₴
              </div>
              <div className="text-xs text-muted-foreground">
                Місячний burn rate
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {prediction.monthlyBurnRate > 0 ? "(витрати > доходи)" : prediction.monthlyBurnRate < 0 ? "(доходи > витрати)" : ""}
              </div>
            </div>
            <div className="text-center p-2 bg-muted rounded-lg">
              <div className="text-xl font-bold">
                {prediction.monthsUntilZero === Infinity
                  ? "∞"
                  : prediction.monthsUntilZero.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">
                Місяців до нуля
              </div>
              <div className="text-[10px] text-muted-foreground mt-1">
                {prediction.monthsUntilZero === Infinity ? "(баланс зростає)" : ""}
              </div>
            </div>
          </div>

          <div className="mb-2 text-xs text-muted-foreground">
            Поточний баланс: <strong>{(prediction.currentBalance / 100).toLocaleString("uk-UA")} ₴</strong>
          </div>

          <div className="space-y-1.5">
            {prediction.yearlyProjection.map((point, index) => {
              const widthPercent = maxBalance > 0 ? (point.balance / maxBalance) * 100 : 0;
              const isNegative = point.balance <= 0;

              return (
                <div key={point.month} className="flex items-center gap-2">
                  <div className="w-16 text-xs text-muted-foreground">
                    {point.month}
                  </div>
                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        isNegative
                          ? "bg-red-500"
                          : index === 0
                          ? "bg-primary"
                          : "bg-primary/60"
                      }`}
                      style={{ width: `${Math.max(widthPercent, 2)}%` }}
                    />
                  </div>
                  <div className="w-24 text-xs text-right font-medium">
                    {(point.balance / 100).toLocaleString("uk-UA")} ₴
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
