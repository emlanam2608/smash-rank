"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";

export function AuthButton() {
  const t = useTranslations("auth");
  const { user, loading, configured, signIn, signOutUser } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!configured) return null;

  async function handleSignIn() {
    if (!configured) {
      setError(t("error"));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await signIn();
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="h-9 w-24 animate-pulse rounded-xl bg-slate-800" />;
  }

  if (user) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => signOutUser()}
        aria-label={t("signOut")}
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">{t("signOut")}</span>
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" size="sm" onClick={handleSignIn} disabled={busy}>
        <LogIn className="h-4 w-4" />
        {busy ? t("signingIn") : t("signIn")}
      </Button>
      {error ? <p className="text-xs text-rose-400">{error}</p> : null}
    </div>
  );
}
