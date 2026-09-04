"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, CalendarDays, Check, ChevronRight, Clock3, Copy, LoaderCircle, Pencil, QrCode, Share2, Trash2, Trophy, Users } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { RankBadge } from "@/components/RankBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/context/SessionContext";
import { db } from "@/lib/firebase";
import { SESSIONS_COLLECTION, sessionFromSnapshot } from "@/lib/firebase/sessions";
import { correctSessionMatch, MATCHES_COLLECTION, USERS_COLLECTION, userFromSnapshot } from "@/lib/matches";
import { getSessionMvp } from "@/lib/session-mvp";
import type { Match, Session, User } from "@/lib/types";

export function SessionsTab() {
  const t = useTranslations("sessionsTab");
  const locale = useLocale();
  const { user, signIn } = useAuth();
  const { setActiveSessionId } = useSession();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<User[]>([]);
  const [qrOpen, setQrOpen] = useState(false);
  const [rosterOpen, setRosterOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [playersLoaded, setPlayersLoaded] = useState(false);
  const [matchesLoaded, setMatchesLoaded] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [deleteMatch, setDeleteMatch] = useState<Match | null>(null);
  const [matchDetails, setMatchDetails] = useState<Match | null>(null);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [savingMatch, setSavingMatch] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !user) return;
    return onSnapshot(query(collection(db, SESSIONS_COLLECTION), where("playerIds", "array-contains", user.uid)), (snapshot) => {
      setSessions(snapshot.docs.map((item) => sessionFromSnapshot(item.id, item.data() as Record<string, unknown>)).sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt)));
      setSessionsLoaded(true);
    }, () => setSessionsLoaded(true));
  }, [user]);

  useEffect(() => {
    if (!db || !user) return;
    return onSnapshot(query(collection(db, USERS_COLLECTION)), (snapshot) => {
      setPlayers(snapshot.docs.map((item) => userFromSnapshot(item.id, item.data() as Record<string, unknown>)));
      setPlayersLoaded(true);
    }, () => setPlayersLoaded(true));
  }, [user]);

  const selected = sessions.find((session) => session.id === selectedId) ?? null;

  useEffect(() => {
    if (!db || !selected) {
      setMatches([]);
      setMatchesLoaded(true);
      return;
    }
    setMatchesLoaded(false);
    return onSnapshot(query(collection(db, MATCHES_COLLECTION), where("sessionId", "==", selected.id)), (snapshot) => {
      setMatches(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Match).sort((a, b) => timestamp(b.createdAt) - timestamp(a.createdAt)));
      setMatchesLoaded(true);
    }, () => setMatchesLoaded(true));
  }, [selected]);

  const mvp = useMemo(() => getSessionMvp(matches), [matches]);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const playerRankById = useMemo(() => new Map([...players].sort((a, b) => b.displayRank - a.displayRank || b.mu - a.mu).map((player, index) => [player.id, index + 1])), [players]);
  const sessionPlayers = useMemo(() => selected?.playerIds.map((id) => ({ id, player: playerById.get(id) })) ?? [], [playerById, selected]);
  const joinUrl = selected ? `${typeof window === "undefined" ? "" : window.location.origin}/${locale}/session/${selected.id}/join` : "";

  async function copyJoinLink() {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function editMatch(match: Match) {
    setEditingMatch(match);
    setScoreA(match.scoreA);
    setScoreB(match.scoreB);
    setMatchError(null);
  }

  async function saveMatch() {
    if (!editingMatch) return;
    setSavingMatch(true);
    setMatchError(null);
    try {
      await correctSessionMatch({ matchId: editingMatch.id, scoreA, scoreB });
      setEditingMatch(null);
    } catch (error) {
      setMatchError(error instanceof Error && error.message === "INVALID_SCORE_RANGE" ? t("invalidScore") : t("matchUpdateError"));
    } finally {
      setSavingMatch(false);
    }
  }

  async function removeMatch() {
    if (!deleteMatch) return;
    setSavingMatch(true);
    setMatchError(null);
    try {
      await correctSessionMatch({ matchId: deleteMatch.id, delete: true });
      setDeleteMatch(null);
    } catch {
      setMatchError(t("matchUpdateError"));
    } finally {
      setSavingMatch(false);
    }
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
            {!sessionsLoaded ? <LoadingIndicator className="py-14" label={t("loading")} /> : sessions.length ? sessions.map((session, index) => <SessionRow key={session.id} session={session} locale={locale} index={index} onClick={() => setSelectedId(session.id)} labels={{ active: t("active"), closed: t("closed"), players: t("players") }} />) : <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] px-6 py-14 text-center text-sm text-slate-400">{t("empty")}</div>}
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

          <motion.button whileTap={{ scale: 0.98 }} type="button" onClick={() => setRosterOpen(true)} className="group mt-3 flex w-full items-center gap-4 rounded-[1.4rem] border border-white/10 bg-slate-900/60 p-4 text-left backdrop-blur-xl transition-colors hover:bg-slate-900">
            <div className="flex min-w-[4.5rem] -space-x-3">
              {sessionPlayers.slice(0, 3).map(({ id, player }, index) => <PlayerAvatar key={id} player={player} fallback={id} className="h-10 w-10 rounded-full border-2 border-slate-900" style={{ zIndex: 3 - index }} />)}
              {!sessionPlayers.length && <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-slate-900 bg-emerald-300/10 text-emerald-300"><Users className="h-4 w-4" /></span>}
            </div>
            <span className="min-w-0 flex-1"><span className="block text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">{t("playerRoster")}</span><span className="mt-1 block text-sm font-black">{selected.playerIds.length} {t("players")}</span></span>
            <span className="flex items-center gap-1 text-[10px] font-black text-slate-500 transition-colors group-hover:text-slate-300">{t("viewPlayers")}<ChevronRight className="h-4 w-4" /></span>
          </motion.button>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatCard icon={<CalendarDays className="h-5 w-5" />} value={matchesLoaded ? String(matches.length) : "…"} label={t("totalMatches")} />
            <StatCard icon={<Trophy className="h-5 w-5" />} value={mvp ?? "—"} label={t("mvp")} gold />
          </div>

          <div className="mt-6">
            <div className="mb-3 flex items-center justify-between"><h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{t("history")}</h2><span className="text-[10px] font-bold text-slate-600">{matches.length} total</span></div>
            <div className="max-h-[22rem] space-y-2 overflow-y-auto pr-1">
              {!matchesLoaded ? <LoadingIndicator className="py-10" label={t("loading")} /> : matches.length ? matches.map((match, index) => <MatchRow key={match.id} match={match} index={index} locale={locale} canManage={selected.hostId === user.uid} onOpen={setMatchDetails} onEdit={editMatch} onDelete={setDeleteMatch} labels={{ edit: t("editMatch"), delete: t("deleteMatch") }} />) : <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">{t("noMatches")}</div>}
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

          <Dialog open={rosterOpen} onOpenChange={setRosterOpen}>
            <DialogContent>
              <DialogTitle className="text-xl font-black">{t("playerRoster")}</DialogTitle>
              <DialogDescription className="text-sm text-slate-400">{selected.title} · {selected.playerIds.length} {t("players")}</DialogDescription>
              <div className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                {!playersLoaded ? <LoadingIndicator className="py-10" label={t("loading")} /> : sessionPlayers.map(({ id, player }, index) => (
                  <motion.div key={id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.035 }} className="flex items-center gap-3 rounded-[1.15rem] border border-white/[0.07] bg-white/[0.035] p-3">
                    <span className="w-5 text-center text-xs font-black text-slate-600">{index + 1}</span>
                    <PlayerAvatar player={player} fallback={id} className="h-11 w-11 rounded-xl" />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-100">{player?.displayName ?? id}</p><p className="mt-0.5 text-[10px] font-bold text-slate-500">{player?.matchesPlayed ?? 0} matches</p></div>
                    {player ? <div className="flex shrink-0 flex-col items-end gap-1"><RankBadge displayRank={playerRankById.get(player.id) ?? 0} matchesPlayed={player.matchesPlayed} /><p className="text-[10px] font-black tabular-nums text-emerald-300">{player.displayRank} <span className="uppercase tracking-wider text-slate-600">{t("points")}</span></p></div> : <div className="text-right"><p className="text-sm font-black tabular-nums text-emerald-300">—</p><p className="text-[9px] font-black uppercase tracking-wider text-slate-600">{t("points")}</p></div>}
                  </motion.div>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={matchDetails !== null} onOpenChange={(open) => !open && setMatchDetails(null)}>
            <DialogContent>
              <DialogTitle>{t("matchDetails")}</DialogTitle>
              <DialogDescription>{matchDetails ? formatDate(matchDetails.createdAt, locale) : ""}</DialogDescription>
              {matchDetails ? <div className="mt-4 space-y-4"><div className="grid grid-cols-[1fr_auto_1fr] items-center rounded-2xl bg-slate-900 px-4 py-5 text-center"><span className="text-3xl font-black text-emerald-300">{matchDetails.scoreA}</span><span className="px-5 text-xs font-black uppercase tracking-widest text-slate-500">vs</span><span className="text-3xl font-black text-sky-300">{matchDetails.scoreB}</span></div><MatchTeam members={matchDetails.teamA} tone="emerald" label={t("teamA")} gainLabel={t("ratingGain")} /><MatchTeam members={matchDetails.teamB} tone="sky" label={t("teamB")} gainLabel={t("ratingGain")} /></div> : null}
            </DialogContent>
          </Dialog>

          <Dialog open={editingMatch !== null} onOpenChange={(open) => !open && setEditingMatch(null)}>
            <DialogContent>
              <DialogTitle>{t("editMatch")}</DialogTitle>
              <DialogDescription>{t("editMatchDescription")}</DialogDescription>
              <div className="mt-4 grid grid-cols-2 gap-3"><Input aria-label={t("teamAScore")} type="number" min="0" max="30" value={scoreA} onChange={(event) => setScoreA(Number(event.target.value))} /><Input aria-label={t("teamBScore")} type="number" min="0" max="30" value={scoreB} onChange={(event) => setScoreB(Number(event.target.value))} /></div>
              {matchError ? <p className="mt-3 text-center text-sm text-rose-400">{matchError}</p> : null}
              <Button className="mt-5 w-full" disabled={savingMatch} onClick={saveMatch}>{savingMatch ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{savingMatch ? t("updatingMatch") : t("saveMatch")}</Button>
            </DialogContent>
          </Dialog>

          <Dialog open={deleteMatch !== null} onOpenChange={(open) => !open && setDeleteMatch(null)}>
            <DialogContent>
              <DialogTitle>{t("deleteMatch")}</DialogTitle>
              <DialogDescription>{t("deleteMatchDescription")}</DialogDescription>
              {matchError ? <p className="mt-3 text-center text-sm text-rose-400">{matchError}</p> : null}
              <Button className="mt-5 w-full" variant="destructive" disabled={savingMatch} onClick={removeMatch}>{savingMatch ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{savingMatch ? t("updatingMatch") : t("confirmDeleteMatch")}</Button>
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

function MatchRow({ match, index, locale, canManage, onOpen, onEdit, onDelete, labels }: { match: Match; index: number; locale: string; canManage: boolean; onOpen: (match: Match) => void; onEdit: (match: Match) => void; onDelete: (match: Match) => void; labels: { edit: string; delete: string } }) {
  const a = match.teamA.map((member) => member.displayName ?? member.userId).join(" / ");
  const b = match.teamB.map((member) => member.displayName ?? member.userId).join(" / ");
  const aWon = match.winner === "teamA";
  return <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.04, 0.25) }} role="button" tabIndex={0} onClick={() => onOpen(match)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(match); }} className="cursor-pointer rounded-[1.25rem] border border-white/[0.07] bg-white/[0.035] p-3.5 transition-colors hover:bg-white/[0.07]"><div className="flex items-center justify-between gap-3"><div className="min-w-0 flex-1"><p className={aWon ? "truncate text-xs font-black text-slate-100" : "truncate text-xs font-bold text-slate-500"}>{a}</p><p className={!aWon ? "mt-1.5 truncate text-xs font-black text-slate-100" : "mt-1.5 truncate text-xs font-bold text-slate-500"}>{b}</p></div><div className="flex items-center gap-3"><div className="text-right text-base font-black tabular-nums"><p className={aWon ? "text-emerald-300" : "text-slate-500"}>{match.scoreA}</p><p className={!aWon ? "text-emerald-300" : "text-slate-500"}>{match.scoreB}</p></div>{canManage ? <div className="flex flex-col gap-1"><button type="button" aria-label={labels.edit} onClick={(event) => { event.stopPropagation(); onEdit(match); }} className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-emerald-300"><Pencil className="h-3.5 w-3.5" /></button><button type="button" aria-label={labels.delete} onClick={(event) => { event.stopPropagation(); onDelete(match); }} className="rounded p-1 text-slate-400 hover:bg-rose-400/10 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /></button></div> : null}</div></div><p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-slate-600">{formatDate(match.createdAt, locale)}</p></motion.div>;
}

function MatchTeam({ members, tone, label, gainLabel }: { members: Match["teamA"]; tone: "emerald" | "sky"; label: string; gainLabel: string }) {
  const gainClass = tone === "emerald" ? "text-emerald-300" : "text-sky-300";
  return <section><p className={`mb-2 text-[10px] font-black uppercase tracking-widest ${gainClass}`}>{label}</p><div className="space-y-2">{members.map((member) => { const gain = member.postRank - member.preRank; return <div key={member.userId} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2.5"><span className="truncate text-sm font-bold">{member.displayName ?? member.userId}</span><span className={`text-sm font-black tabular-nums ${gainClass}`}>{gain >= 0 ? "+" : ""}{gain} <span className="text-[9px] uppercase tracking-wide text-slate-500">{gainLabel}</span></span></div>; })}</div></section>;
}

function PlayerAvatar({ player, fallback, className, style }: { player?: User; fallback: string; className: string; style?: React.CSSProperties }) {
  if (player?.photoURL) return <img src={player.photoURL} alt="" className={`${className} shrink-0 object-cover`} style={style} />;
  const initial = player?.displayName?.slice(0, 1).toUpperCase() ?? fallback.slice(0, 1).toUpperCase();
  return <span className={`${className} flex shrink-0 items-center justify-center bg-gradient-to-br from-emerald-200 to-emerald-600 text-xs font-black text-slate-950`} style={style}>{initial}</span>;
}

function timestamp(value: unknown) { return value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function" ? value.toMillis() : 0; }
function formatDate(value: unknown, locale: string) { const stamp = timestamp(value); return stamp ? new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", year: "numeric" }).format(stamp) : "—"; }
