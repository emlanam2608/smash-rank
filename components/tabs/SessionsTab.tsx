"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CalendarDays, Check, ChevronRight, Clock3, Copy, QrCode, Share2, Trophy, Users } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/context/SessionContext";
import { db } from "@/lib/firebase";
import { SESSIONS_COLLECTION, sessionFromSnapshot } from "@/lib/firebase/sessions";
import { MATCHES_COLLECTION } from "@/lib/matches";
import type { Match, Session } from "@/lib/types";

export function SessionsTab() {
  const t = useTranslations("sessionsTab");
  const locale = useLocale();
  const { user, signIn } = useAuth();
  const { setActiveSessionId } = useSession();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!db || !user) return;
    return onSnapshot(query(collection(db, SESSIONS_COLLECTION), where("playerIds", "array-contains", user.uid)), (snapshot) => {
      setSessions(snapshot.docs.map((item) => sessionFromSnapshot(item.id, item.data() as Record<string, unknown>)).sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt)));
    });
  }, [user]);

  const selected = sessions.find((session) => session.id === selectedId) ?? null;

  useEffect(() => {
    if (!db || !selected) {
      setMatches([]);
      return;
    }
    return onSnapshot(query(collection(db, MATCHES_COLLECTION), where("sessionId", "==", selected.id)), (snapshot) => {
      setMatches(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Match).sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt)));
    });
  }, [selected]);

  const mvp = useMemo(() => sessionMvp(matches), [matches]);
  const joinUrl = selected ? `${typeof window === "undefined" ? "" : window.location.origin}/${locale}/session/${selected.id}/join` : "";

  async function copyJoinLink() {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  if (!user) {
    return <div className="rounded-[2rem] border border-white/10 bg-slate-900/50 p-7 text-center"><Users className="mx-auto h-8 w-8 text-emerald-300" /><p className="mt-4 text-sm text-slate-400">{t("signInPrompt")}</p><Button className="mt-5 w-full" onClick={() => signIn()}>{t("signIn")}</Button></div>;
  }

  return (
    <AnimatePresence initial={false} mode="wait">
      {!selected ? (
        <motion.section key="list" initial={{ opacity: 0, x: -18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -18 }} transition={{ duration: 0.2 }}>
          <header className="px-1">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300"><Clock3 className="h-3.5 w-3.5" /> {t("eyebrow")}</div>
            <h1 className="mt-2 text-[2rem] font-black leading-none tracking-[-0.04em]">{t("title")}</h1>
            <p className="mt-2 text-sm text-slate-400">Every court night, all in one place.</p>
          </header>
          <div className="mt-7 space-y-3">
            {sessions.length ? sessions.map((session, index) => <SessionRow key={session.id} session={session} locale={locale} index={index} onClick={() => setSelectedId(session.id)} labels={{ active: t("active"), closed: t("closed"), players: t("players") }} />) : <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] px-6 py-14 text-center text-sm text-slate-400">{t("empty")}</div>}
          </div>
        </motion.section>
      ) : (
        <motion.section key="detail" initial={{ opacity: 0, x: 22 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 22 }} transition={{ duration: 0.22 }}>
          <header>
            <button type="button" onClick={() => setSelectedId(null)} className="flex items-center gap-2 text-xs font-bold text-slate-400 transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" /> {t("back")}</button>
            <div className="mt-5 flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">{t("detail")}</p><h1 className="mt-2 truncate text-2xl font-black tracking-tight">{selected.title}</h1><p className="mt-1 text-xs text-slate-500">{formatDate(selected.createdAt, locale)} · {selected.playerIds.length} {t("players")}</p></div>
              <span className={selected.status === "active" ? "rounded-full bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black uppercase text-emerald-300 ring-1 ring-emerald-300/20" : "rounded-full bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase text-slate-400"}>{selected.status === "active" ? t("active") : t("closed")}</span>
            </div>
          </header>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={() => setQrOpen(true)} className="flex min-h-24 flex-col items-start justify-between rounded-[1.4rem] border border-white/10 bg-slate-900/60 p-4 text-left backdrop-blur-xl"><QrCode className="h-6 w-6 text-emerald-300" /><span className="text-sm font-black">{t("viewQr")}</span></motion.button>
            <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={copyJoinLink} className="flex min-h-24 flex-col items-start justify-between rounded-[1.4rem] border border-white/10 bg-slate-900/60 p-4 text-left backdrop-blur-xl">{copied ? <Check className="h-6 w-6 text-emerald-300" /> : <Copy className="h-6 w-6 text-emerald-300" />}<span className="text-sm font-black">{copied ? "Copied" : t("copyLink")}</span></motion.button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatCard icon={<CalendarDays className="h-5 w-5" />} value={String(matches.length)} label={t("totalMatches")} />
            <StatCard icon={<Trophy className="h-5 w-5" />} value={mvp ?? "—"} label={t("mvp")} gold />
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t("history")}</h2><span className="text-[10px] font-bold text-slate-600">{matches.length} total</span></div>
            <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
              {matches.length ? matches.map((match, index) => <MatchRow key={match.id} match={match} index={index} locale={locale} />) : <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">{t("noMatches")}</div>}
            </div>
          </div>

          <Button className="mt-5 w-full" disabled={selected.status !== "active"} onClick={() => setActiveSessionId(selected.id)}><Users className="h-4 w-4" />{t("useSession")}</Button>

          <Dialog open={qrOpen} onOpenChange={setQrOpen}>
            <DialogContent className="items-center text-center">
              <DialogTitle className="text-xl font-black">{t("viewQr")}</DialogTitle>
              <DialogDescription className="text-sm text-slate-400">{selected.title}</DialogDescription>
              <div className="mt-5 rounded-[1.5rem] bg-white p-4 shadow-[0_0_40px_rgba(255,255,255,.12)]"><QRCodeSVG value={joinUrl} size={230} level="H" includeMargin /></div>
              <Button className="mt-5 w-full" onClick={() => navigator.share?.({ title: selected.title, url: joinUrl })}><Share2 className="h-4 w-4" />{t("share")}</Button>
            </DialogContent>
          </Dialog>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function SessionRow({ session, locale, index, onClick, labels }: { session: Session; locale: string; index: number; onClick: () => void; labels: { active: string; closed: string; players: string } }) {
  return <motion.button initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} whileTap={{ scale: 0.98 }} type="button" onClick={onClick} className="group flex min-h-24 w-full items-center gap-4 rounded-[1.5rem] border border-white/10 bg-slate-900/55 p-4 text-left backdrop-blur-xl transition-colors hover:bg-slate-900"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-300/10 text-emerald-300"><CalendarDays className="h-6 w-6" /></span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="truncate text-sm font-black">{session.title}</span>{session.status === "active" && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300 shadow-[0_0_8px_rgba(52,211,153,.8)]" />}</span><span className="mt-1.5 block text-[11px] font-medium text-slate-500">{formatDate(session.createdAt, locale)} · {session.playerIds.length} {labels.players}</span><span className={session.status === "active" ? "mt-2 inline-block text-[9px] font-black uppercase tracking-wider text-emerald-300" : "mt-2 inline-block text-[9px] font-black uppercase tracking-wider text-slate-600"}>{session.status === "active" ? labels.active : labels.closed}</span></span><ChevronRight className="h-5 w-5 text-slate-600 transition-transform group-hover:translate-x-1" /></motion.button>;
}

function StatCard({ icon, value, label, gold = false }: { icon: React.ReactNode; value: string; label: string; gold?: boolean }) {
  return <div className="min-h-32 rounded-[1.4rem] border border-white/10 bg-slate-900/55 p-4"><span className={gold ? "text-amber-300" : "text-emerald-300"}>{icon}</span><p className="mt-5 truncate text-2xl font-black">{value}</p><p className="mt-1 text-[10px] font-bold text-slate-500">{label}</p></div>;
}

function MatchRow({ match, index, locale }: { match: Match; index: number; locale: string }) {
  const a = match.teamA.map((member) => member.displayName ?? member.userId).join(" / ");
  const b = match.teamB.map((member) => member.displayName ?? member.userId).join(" / ");
  const aWon = match.winner === "teamA";
  return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.04, 0.25) }} className="rounded-[1.25rem] border border-white/[0.07] bg-white/[0.035] p-3.5"><div className="flex items-center justify-between gap-3"><div className="min-w-0 flex-1"><p className={aWon ? "truncate text-xs font-black text-slate-100" : "truncate text-xs font-bold text-slate-500"}>{a}</p><p className={!aWon ? "mt-1.5 truncate text-xs font-black text-slate-100" : "mt-1.5 truncate text-xs font-bold text-slate-500"}>{b}</p></div><div className="flex items-center gap-3"><div className="text-right text-base font-black tabular-nums"><p className={aWon ? "text-emerald-300" : "text-slate-500"}>{match.scoreA}</p><p className={!aWon ? "text-emerald-300" : "text-slate-500"}>{match.scoreB}</p></div></div></div><p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-slate-600">{formatDate(match.createdAt, locale)}</p></motion.div>;
}

function timestamp(value: unknown) { return value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function" ? value.toMillis() : 0; }
function formatDate(value: unknown, locale: string) { const stamp = timestamp(value); return stamp ? new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(stamp) : "—"; }
function sessionMvp(matches: Match[]) { const wins = new Map<string, number>(); for (const match of matches) { const team = match.winner === "teamA" ? match.teamA : match.winner === "teamB" ? match.teamB : []; for (const member of team) { const name = member.displayName ?? member.userId; wins.set(name, (wins.get(name) ?? 0) + 1); } } return [...wins.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]; }
