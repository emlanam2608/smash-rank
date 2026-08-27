"use client";

import { useEffect, useState } from "react";
import { Radio, Users } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSession } from "@/context/SessionContext";
import { getRealtimeSession } from "@/lib/firebase/sessions";
import type { Session } from "@/lib/types";

export function ActiveSessionBanner() {
  const t = useTranslations("session");
  const { activeSessionId, setActiveSessionId } = useSession();
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => { if (!activeSessionId) { setSession(null); return; } return getRealtimeSession(activeSessionId, setSession); }, [activeSessionId]);
  if (!session || session.status !== "active") return null;
  return <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 shadow-glow"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400 text-slate-950"><Radio className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">{t("activeNow")}</p><p className="truncate text-sm font-black">{session.title}</p></div><span className="flex items-center gap-1 text-xs font-black text-emerald-200"><Users className="h-4 w-4" />{session.playerIds.length}</span><button type="button" onClick={() => setActiveSessionId(null)} aria-label={t("clearActive")} className="text-xs font-bold text-slate-400 hover:text-white">×</button></div>;
}
