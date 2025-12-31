"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Flame, LogIn, AlertCircle, Shield, ArrowLeft } from "lucide-react";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // If we're not in 2FA mode yet, first check if 2FA is required
      if (!requires2FA) {
        console.log("[LOGIN] Checking pre-login for:", email);

        const preLoginRes = await fetch("/api/auth/pre-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (preLoginRes.status === 429) {
          setError("Забагато спроб. Зачекайте хвилину і спробуйте знову.");
          return;
        }

        const preLoginData = await preLoginRes.json();
        console.log("[LOGIN] Pre-login result:", preLoginData);

        if (!preLoginData.valid) {
          setError("Невірний email або пароль");
          return;
        }

        if (preLoginData.requires2FA) {
          console.log("[LOGIN] 2FA required, showing 2FA form");
          setRequires2FA(true);
          setError(null);
          return;
        }
      }

      // Proceed with actual signIn (with or without 2FA code)
      const credentials: Record<string, string | boolean> = {
        email,
        password,
        redirect: false,
      };
      if (requires2FA && totpCode) {
        credentials.totpCode = totpCode;
      }

      console.log("[LOGIN] Attempting signIn with:", {
        email,
        hasPassword: !!password,
        requires2FA,
        hasTotpCode: !!totpCode
      });

      const result = await signIn("credentials", credentials) as { ok?: boolean; error?: string; status?: number } | undefined;

      console.log("[LOGIN] signIn result:", result);

      if (result?.error) {
        if (result.status === 429) {
          setError("Забагато спроб. Зачекайте хвилину і спробуйте знову.");
        } else if (requires2FA) {
          setError("Невірний код двофакторної автентифікації");
        } else {
          setError("Невірний email або пароль");
        }
      } else if (result?.ok) {
        // Use window.location for full page reload to ensure cookie is set
        window.location.href = callbackUrl;
      } else {
        setError("Помилка входу. Спробуйте ще раз.");
      }
    } catch {
      setError("Помилка входу. Спробуйте ще раз.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setError("Помилка входу через Google. Спробуйте ще раз.");
      setIsGoogleLoading(false);
    }
  };

  const handleBack = () => {
    setRequires2FA(false);
    setTotpCode("");
    setError(null);
  };

  // 2FA verification screen
  if (requires2FA) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex items-center gap-2">
              <Shield className="w-8 h-8 text-blue-500" />
              <span className="text-2xl font-bold">Двофакторна автентифікація</span>
            </div>
          </div>
          <CardTitle>Введіть код</CardTitle>
          <CardDescription>
            Введіть 6-значний код з Google Authenticator або backup code.
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
              <Label htmlFor="totpCode">Код підтвердження</Label>
              <Input
                id="totpCode"
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\s/g, ""))}
                placeholder="123456 або ABCD1234"
                required
                autoComplete="one-time-code"
                autoFocus
                maxLength={8}
              />
              <p className="text-xs text-muted-foreground">
                6-значний код з додатку або 8-символьний backup code.
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>Перевірка...</>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Підтвердити
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={handleBack}
              disabled={isLoading}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад до входу
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center px-4 md:px-6">
        <div className="flex justify-center mb-3 md:mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-6 h-6 md:w-8 md:h-8 text-orange-500" />
            <span className="text-xl md:text-2xl font-bold">Burn Rate Calendar</span>
          </div>
        </div>
        <CardTitle className="text-lg md:text-xl">Вхід</CardTitle>
        <CardDescription>
          Увійдіть через Google або використайте email та пароль.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 md:px-6">
        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignIn}
          disabled={isGoogleLoading || isLoading}
        >
          {isGoogleLoading ? (
            <>Вхід через Google...</>
          ) : (
            <>
              <GoogleIcon className="w-4 h-4 mr-2" />
              Увійти через Google
            </>
          )}
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              або
            </span>
          </div>
        </div>

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
              disabled={isGoogleLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              minLength={8}
              disabled={isGoogleLoading}
            />
            <Link
              href="/forgot-password"
              className="text-xs text-primary hover:underline"
            >
              Забули пароль?
            </Link>
          </div>

          <Button type="submit" className="w-full" disabled={isLoading || isGoogleLoading}>
            {isLoading ? (
              <>Вхід...</>
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                Увійти з паролем
              </>
            )}
          </Button>
        </form>

        <div className="text-center text-sm">
          <span className="text-muted-foreground">Немає акаунту? </span>
          <Link href="/register" className="text-primary hover:underline">
            Зареєструватися
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Suspense fallback={
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            Завантаження...
          </CardContent>
        </Card>
      }>
        <LoginForm />
      </Suspense>
    </div>
  );
}
