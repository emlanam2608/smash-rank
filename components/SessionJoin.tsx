"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, LogIn } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/context/SessionContext";
import { joinSessionByQR } from "@/lib/firebase/sessions";
import type { Session } from "@/lib/types";

export function SessionJoin({ sessionId }: { sessionId: string }) {
  const t = useTranslations("session");
  const { user, loading, configured, signIn } = useAuth();
  const { setActiveSessionId } = useSession();
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<"loading" | "signIn" | "joining" | "joined" | "closed" | "missing" | "error">("loading");

  useEffect(() => {
    if (!configured) return setState("error");
    if (loading) return;
    if (!user) return setState("signIn");
    let cancelled = false;
    async function join() {
      setState("joining");
      try {
        const joinedSession = await joinSessionByQR(sessionId);
        if (cancelled) return;
        setSession(joinedSession);
        setActiveSessionId(sessionId);
        setState("joined");
      } catch (error) {
        if (cancelled) return;
        const code = error instanceof Error ? error.message : "";
        setState(code === "SESSION_CLOSED" ? "closed" : code === "SESSION_NOT_FOUND" ? "missing" : "error");
      }
    }
    void join();
    return () => { cancelled = true; };
  }, [configured, loading, sessionId, setActiveSessionId, user]);

  const content = state === "signIn" ? <><CardDescription>{t("signInPrompt")}</CardDescription><Button className="mt-5 w-full" onClick={() => signIn().catch(() => setState("error"))}><LogIn className="h-4 w-4" />{t("signIn")}</Button></> : state === "joined" ? <><CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" /><CardDescription className="mt-3 text-center text-base text-slate-200">{t("checkedInTo", { title: session?.title ?? t("session") })}</CardDescription></> : state === "closed" ? <CardDescription>{t("sessionClosed")}</CardDescription> : state === "missing" ? <CardDescription>{t("notFound")}</CardDescription> : state === "error" ? <CardDescription>{t("errors.join")}</CardDescription> : <CardDescription>{state === "joining" ? t("joining") : t("loading")}</CardDescription>;
  return <main className="flex min-h-dvh items-center justify-center bg-slate-950 px-4 text-slate-100"><Card className="w-full max-w-sm text-center"><CardHeader><CardTitle>{t("joinTitle")}</CardTitle></CardHeader><CardContent>{content}</CardContent></Card></main>;
}
