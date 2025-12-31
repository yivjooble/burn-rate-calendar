"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Shield, ShieldCheck, ShieldOff, Copy, Check, RefreshCw, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TwoFactorStatus {
  enabled: boolean;
  hasBackupCodes: boolean;
}

interface SetupData {
  secret: string;
  qrCode: string;
  uri: string;
}

export function TwoFactorSettings() {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Setup state
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Backup codes state
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedBackup, setCopiedBackup] = useState(false);

  // Disable state
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  // Regenerate backup codes state
  const [showRegenerateDialog, setShowRegenerateDialog] = useState(false);
  const [regenerateCode, setRegenerateCode] = useState("");
  const [regenerateLoading, setRegenerateLoading] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const response = await fetch("/api/auth/2fa", { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setStatus(data);
      } else {
        setError("Не вдалося отримати статус 2FA");
      }
    } catch {
      setError("Помилка з'єднання");
    } finally {
      setLoading(false);
    }
  };

  const handleSetup = async () => {
    setSetupLoading(true);
    setSetupError(null);
    try {
      const response = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup" }),
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok) {
        setSetupData(data);
      } else {
        setSetupError(data.error || "Помилка налаштування");
      }
    } catch {
      setSetupError("Помилка з'єднання");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleEnable = async () => {
    if (!setupData || !setupCode) return;
    setSetupLoading(true);
    setSetupError(null);
    try {
      const response = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "enable",
          secret: setupData.secret,
          code: setupCode,
        }),
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok) {
        setBackupCodes(data.backupCodes);
        setShowBackupCodes(true);
        setSetupData(null);
        setSetupCode("");
        setStatus({ enabled: true, hasBackupCodes: true });
      } else {
        setSetupError(data.error || "Невірний код");
      }
    } catch {
      setSetupError("Помилка з'єднання");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!disableCode) return;
    setDisableLoading(true);
    setDisableError(null);
    try {
      const response = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "disable", code: disableCode }),
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok) {
        setStatus({ enabled: false, hasBackupCodes: false });
        setShowDisableDialog(false);
        setDisableCode("");
      } else {
        setDisableError(data.error || "Невірний код");
      }
    } catch {
      setDisableError("Помилка з'єднання");
    } finally {
      setDisableLoading(false);
    }
  };

  const handleRegenerateBackup = async () => {
    if (!regenerateCode) return;
    setRegenerateLoading(true);
    setRegenerateError(null);
    try {
      const response = await fetch("/api/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "regenerate-backup", code: regenerateCode }),
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok) {
        setBackupCodes(data.backupCodes);
        setShowBackupCodes(true);
        setShowRegenerateDialog(false);
        setRegenerateCode("");
      } else {
        setRegenerateError(data.error || "Невірний код");
      }
    } catch {
      setRegenerateError("Помилка з'єднання");
    } finally {
      setRegenerateLoading(false);
    }
  };

  const copyBackupCodes = () => {
    if (backupCodes) {
      navigator.clipboard.writeText(backupCodes.join("\n"));
      setCopiedBackup(true);
      setTimeout(() => setCopiedBackup(false), 2000);
    }
  };

  const cancelSetup = () => {
    setSetupData(null);
    setSetupCode("");
    setSetupError(null);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Двофакторна автентифікація
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-muted-foreground">
            <RefreshCw className="w-4 h-4 animate-spin" />
            Завантаження...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Двофакторна автентифікація
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-500">{error}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Двофакторна автентифікація
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Status indicator */}
          <div className="flex items-center gap-2">
            {status?.enabled ? (
              <>
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <span className="text-sm text-emerald-600 font-medium">2FA увімкнено</span>
              </>
            ) : (
              <>
                <ShieldOff className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">2FA вимкнено</span>
              </>
            )}
          </div>

          {/* Setup flow */}
          {!status?.enabled && !setupData && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Додайте додатковий рівень захисту для вашого акаунту за допомогою
                автентифікатора (Google Authenticator, Authy тощо).
              </p>
              <Button onClick={handleSetup} disabled={setupLoading}>
                {setupLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Налаштування...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Увімкнути 2FA
                  </>
                )}
              </Button>
            </div>
          )}

          {/* QR Code setup */}
          {setupData && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium mb-3">
                  1. Відскануйте QR-код у вашому автентифікаторі:
                </p>
                <div className="flex justify-center mb-3">
                  <img
                    src={setupData.qrCode}
                    alt="QR Code for 2FA"
                    className="w-48 h-48 border rounded"
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center mb-2">
                  Або введіть ключ вручну:
                </p>
                <code className="block text-xs bg-background p-2 rounded text-center break-all">
                  {setupData.secret}
                </code>
              </div>

              <div className="space-y-2">
                <Label htmlFor="setup-code">
                  2. Введіть 6-значний код з автентифікатора:
                </Label>
                <Input
                  id="setup-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={setupCode}
                  onChange={(e) => setSetupCode(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-lg tracking-widest"
                />
              </div>

              {setupError && (
                <p className="text-sm text-red-500">{setupError}</p>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleEnable}
                  disabled={setupLoading || setupCode.length !== 6}
                  className="flex-1"
                >
                  {setupLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    "Підтвердити"
                  )}
                </Button>
                <Button variant="outline" onClick={cancelSetup}>
                  Скасувати
                </Button>
              </div>
            </div>
          )}

          {/* Enabled state - manage options */}
          {status?.enabled && !setupData && (
            <div className="space-y-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRegenerateDialog(true)}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Оновити резервні коди
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDisableDialog(true)}
              >
                <ShieldOff className="w-4 h-4 mr-2" />
                Вимкнути 2FA
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Backup Codes Dialog */}
      <Dialog open={showBackupCodes} onOpenChange={setShowBackupCodes}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Резервні коди
            </DialogTitle>
            <DialogDescription>
              Збережіть ці коди в безпечному місці. Кожен код можна використати лише один раз
              для входу, якщо ви втратите доступ до автентифікатора.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 p-4 bg-muted rounded-lg font-mono text-sm">
            {backupCodes?.map((code, index) => (
              <div key={index} className="p-2 bg-background rounded text-center">
                {code}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={copyBackupCodes}>
              {copiedBackup ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Скопійовано
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  Копіювати
                </>
              )}
            </Button>
            <Button onClick={() => setShowBackupCodes(false)}>
              Я зберіг коди
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Disable 2FA Dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Вимкнути 2FA</DialogTitle>
            <DialogDescription>
              Введіть код з автентифікатора для підтвердження вимкнення двофакторної автентифікації.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="disable-code">Код підтвердження</Label>
            <Input
              id="disable-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-lg tracking-widest"
            />
            {disableError && (
              <p className="text-sm text-red-500">{disableError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDisableDialog(false)}>
              Скасувати
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={disableLoading || disableCode.length !== 6}
            >
              {disableLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                "Вимкнути"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate Backup Codes Dialog */}
      <Dialog open={showRegenerateDialog} onOpenChange={setShowRegenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Оновити резервні коди</DialogTitle>
            <DialogDescription>
              Введіть код з автентифікатора для генерації нових резервних кодів.
              Старі коди будуть недійсними.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="regenerate-code">Код підтвердження</Label>
            <Input
              id="regenerate-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={regenerateCode}
              onChange={(e) => setRegenerateCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-lg tracking-widest"
            />
            {regenerateError && (
              <p className="text-sm text-red-500">{regenerateError}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegenerateDialog(false)}>
              Скасувати
            </Button>
            <Button
              onClick={handleRegenerateBackup}
              disabled={regenerateLoading || regenerateCode.length !== 6}
            >
              {regenerateLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                "Згенерувати"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
