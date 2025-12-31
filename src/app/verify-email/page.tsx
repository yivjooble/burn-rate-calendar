"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, RefreshCw, ArrowRight, Flame } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isVerifying, setIsVerifying] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setError("Посилання недійсне - відсутній токен");
        setIsVerifying(false);
        return;
      }

      try {
        // First validate the token
        const validateResponse = await fetch(`/api/auth/verify-email?token=${token}`);
        const validateData = await validateResponse.json();

        if (!validateData.valid) {
          setError(validateData.error || "Посилання недійсне або вже використане");
          setIsVerifying(false);
          return;
        }

        setEmail(validateData.email);

        // Then verify the email
        const verifyResponse = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const verifyData = await verifyResponse.json();

        if (verifyResponse.ok && verifyData.success) {
          setIsSuccess(true);
        } else {
          setError(verifyData.error || "Помилка підтвердження email");
        }
      } catch {
        setError("Помилка з'єднання. Спробуйте ще раз.");
      } finally {
        setIsVerifying(false);
      }
    };

    verifyEmail();
  }, [token]);

  // Loading state
  if (isVerifying) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <div className="flex flex-col items-center justify-center gap-4 text-muted-foreground">
            <RefreshCw className="w-8 h-8 animate-spin" />
            <p>Підтвердження email...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Success state
  if (isSuccess) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-emerald-500" />
          </div>
          <CardTitle>Email підтверджено!</CardTitle>
          <CardDescription>
            {email ? (
              <>Ваш акаунт <strong>{email}</strong> активовано.</>
            ) : (
              <>Ваш акаунт успішно активовано.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Тепер ви можете увійти в свій акаунт та почати відстежувати свої фінанси.
          </p>
          <Link href="/login">
            <Button className="w-full">
              Увійти
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // Error state
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <AlertCircle className="w-16 h-16 text-red-500" />
        </div>
        <CardTitle>Помилка підтвердження</CardTitle>
        <CardDescription>
          {error || "Посилання недійсне або вже використане."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          Посилання для підтвердження email дійсне лише 24 години.
          Якщо воно застаріло, зареєструйтесь повторно.
        </p>
        <div className="space-y-2">
          <Link href="/register">
            <Button className="w-full">
              Зареєструватися знову
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="ghost" className="w-full">
              Повернутися до входу
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Flame className="w-8 h-8 text-orange-500" />
          <span className="text-2xl font-bold">Burn Rate Calendar</span>
        </div>
        <Suspense fallback={
          <Card className="w-full max-w-md">
            <CardContent className="p-8 text-center">
              Завантаження...
            </CardContent>
          </Card>
        }>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
