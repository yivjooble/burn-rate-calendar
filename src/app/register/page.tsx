"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Flame, UserPlus, ArrowLeft, CheckCircle, AlertCircle, Check, X } from "lucide-react";
import { getPasswordStrength } from "@/lib/validation";

function PasswordStrengthIndicator({ password }: { password: string }) {
  const strength = getPasswordStrength(password);

  const getColorClass = (score: number, allMet: boolean) => {
    if (allMet) return "bg-emerald-500";
    if (score === 0) return "bg-gray-200";
    if (score <= 2) return "bg-red-500";
    if (score === 3) return "bg-orange-500";
    if (score === 4) return "bg-yellow-500";
    return "bg-emerald-500";
  };

  const getLabelColor = (score: number, allMet: boolean) => {
    if (allMet) return "text-emerald-600";
    if (score === 0) return "text-gray-400";
    if (score <= 2) return "text-red-500";
    if (score <= 4) return "text-yellow-600";
    return "text-emerald-600";
  };

  if (!password) return null;

  return (
    <div className="space-y-2 mt-2">
      {/* Strength bar */}
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= strength.score ? getColorClass(strength.score, strength.allMet) : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {/* Strength label */}
      <div className="flex items-center justify-between">
        <p className={`text-xs font-medium ${getLabelColor(strength.score, strength.allMet)}`}>
          {strength.label}
        </p>
        {!strength.allMet && strength.score > 0 && (
          <p className="text-xs text-muted-foreground">
            Потрібно виконати всі вимоги
          </p>
        )}
      </div>

      {/* Requirements checklist */}
      <div className="grid grid-cols-2 gap-1 text-xs">
        <RequirementItem met={strength.checks.length} label="12+ символів" />
        <RequirementItem met={strength.checks.uppercase} label="Велика літера (A-Z)" />
        <RequirementItem met={strength.checks.lowercase} label="Мала літера (a-z)" />
        <RequirementItem met={strength.checks.number} label="Цифра (0-9)" />
        <RequirementItem met={strength.checks.special} label="Спецсимвол (!@#$...)" />
      </div>
    </div>
  );
}

function RequirementItem({ met, label }: { met: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1 ${met ? "text-emerald-600" : "text-muted-foreground"}`}>
      {met ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
      <span>{label}</span>
    </div>
  );
}

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Паролі не співпадають");
      return;
    }

    // Validate password strength - all 5 requirements must be met
    const strength = getPasswordStrength(password);
    if (!strength.allMet) {
      // Find which requirements are not met
      const missing = [];
      if (!strength.checks.length) missing.push("мінімум 12 символів");
      if (!strength.checks.uppercase) missing.push("велика літера (A-Z)");
      if (!strength.checks.lowercase) missing.push("мала літера (a-z)");
      if (!strength.checks.number) missing.push("цифра (0-9)");
      if (!strength.checks.special) missing.push("спецсимвол (!@#$...)");

      setError(`Пароль не відповідає вимогам: потрібно ${missing.join(", ")}`);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.status === 429) {
        setError(data.error || "Забагато спроб. Зачекайте 5 хвилин.");
      } else if (response.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "Помилка реєстрації");
      }
    } catch {
      setError("Помилка з'єднання. Спробуйте ще раз.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <CheckCircle className="w-16 h-16 text-emerald-500" />
            </div>
            <CardTitle>Перевірте вашу пошту</CardTitle>
            <CardDescription>
              Ми надіслали лист на <strong>{email}</strong> з посиланням для підтвердження.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Натисніть посилання в листі, щоб активувати ваш акаунт.
              Посилання дійсне 24 години.
            </p>
            <p className="text-sm text-muted-foreground text-center">
              Не отримали листа? Перевірте папку &quot;Спам&quot;.
            </p>
            <Link href="/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Повернутися до входу
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2">
              <Flame className="w-8 h-8 text-orange-500" />
              <span className="text-2xl font-bold">Burn Rate Calendar</span>
            </div>
          </div>
          <CardTitle>Реєстрація</CardTitle>
          <CardDescription>
            Створіть акаунт для відстеження ваших фінансів.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoComplete="email"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Створіть надійний пароль"
                required
                autoComplete="new-password"
              />
              <PasswordStrengthIndicator password={password} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Підтвердіть пароль</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторіть пароль"
                required
                autoComplete="new-password"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="text-xs text-red-500">Паролі не співпадають</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>Реєстрація...</>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Зареєструватися
                </>
              )}
            </Button>
          </form>

          <div className="text-center text-sm">
            <span className="text-muted-foreground">Вже маєте акаунт? </span>
            <Link href="/login" className="text-primary hover:underline">
              Увійти
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
