"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Flame, Lock, ArrowLeft, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("Посилання недійсне");
        setIsValidating(false);
        return;
      }

      try {
        const response = await fetch(`/api/auth/reset-password?token=${token}`);
        const data = await response.json();

        if (data.valid) {
          setTokenValid(true);
          setUserEmail(data.email);
        } else {
          setError(data.error || "Посилання недійсне або вже використане");
        }
      } catch {
        setError("Помилка перевірки посилання");
      } finally {
        setIsValidating(false);
      }
    };

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Паролі не співпадають");
      return;
    }

    if (password.length < 8) {
      setError("Пароль повинен містити мінімум 8 символів");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.status === 429) {
        setError(data.error || "Забагато спроб. Зачекайте 5 хвилин.");
      } else if (response.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "Помилка при зміні пароля");
      }
    } catch {
      setError("Помилка з'єднання. Спробуйте ще раз.");
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state
  if (isValidating) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <RefreshCw className="w-5 h-5 animate-spin" />
            Перевірка посилання...
          </div>
        </CardContent>
      </Card>
    );
  }

  // Invalid token
  if (!tokenValid && !success) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <AlertCircle className="w-16 h-16 text-red-500" />
          </div>
          <CardTitle>Посилання недійсне</CardTitle>
          <CardDescription>
            {error || "Посилання для скидання пароля недійсне або вже використане."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Посилання діє лише 1 годину. Спробуйте запросити нове посилання.
          </p>
          <Link href="/forgot-password">
            <Button className="w-full">
              Запросити нове посилання
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="ghost" className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Повернутися до входу
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Success state
  if (success) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-emerald-500" />
          </div>
          <CardTitle>Пароль змінено</CardTitle>
          <CardDescription>
            Ваш пароль успішно змінено. Тепер ви можете увійти з новим паролем.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login">
            <Button className="w-full">
              Увійти
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Reset form
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-8 h-8 text-orange-500" />
            <span className="text-2xl font-bold">Burn Rate Calendar</span>
          </div>
        </div>
        <CardTitle>Новий пароль</CardTitle>
        <CardDescription>
          {userEmail && (
            <>Встановіть новий пароль для <strong>{userEmail}</strong></>
          )}
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
            <Label htmlFor="password">Новий пароль</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Мінімум 8 символів"
              required
              autoComplete="new-password"
              minLength={8}
              autoFocus
            />
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
              minLength={8}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>Зміна пароля...</>
            ) : (
              <>
                <Lock className="w-4 h-4 mr-2" />
                Змінити пароль
              </>
            )}
          </Button>
        </form>

        <Link href="/login">
          <Button variant="ghost" className="w-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Повернутися до входу
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense fallback={
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            Завантаження...
          </CardContent>
        </Card>
      }>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
