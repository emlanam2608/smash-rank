"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { CheckCircle2, ChevronDown, LoaderCircle, LogIn, Minus, Plus, Search, Sparkles, UserPlus, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { RankBadge } from "@/components/RankBadge";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSession } from "@/context/SessionContext";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { recordMatch, USERS_COLLECTION, userFromSnapshot } from "@/lib/matches";
import { sessionFromSnapshot, SESSIONS_COLLECTION } from "@/lib/sessions";
import { MAX_MATCH_SCORE, MIN_MATCH_SCORE, isValidBadmintonScore } from "@/lib/trueskill";
import type { MatchType, Session, User } from "@/lib/types";
import { cn } from "@/lib/utils";

type SlotKey = "a1" | "a2" | "b1" | "b2";
const EMPTY_SLOTS: Record<SlotKey, string> = { a1: "", a2: "", b1: "", b2: "" };
const ACTIVE_SLOTS: Record<MatchType, SlotKey[]> = { "1v1": ["a1", "b1"], "2v2": ["a1", "a2", "b1", "b2"] };

export function MatchForm() {
  const t = useTranslations("match");
  const tAuth = useTranslations("auth");
  const tSession = useTranslations("session");
  const { user, configured, signIn } = useAuth();
  const { activeSessionId, setActiveSessionId } = useSession();
  const [players, setPlayers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [matchType, setMatchType] = useState<MatchType>("2v2");
  const [slots, setSlots] = useState(EMPTY_SLOTS);
  const [scoreA, setScoreA] = useState(21);
  const [scoreB, setScoreB] = useState(19);
  const [pickerSlot, setPickerSlot] = useState<SlotKey | null>(null);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [playersLoaded, setPlayersLoaded] = useState(false);
  const [sessionsLoaded, setSessionsLoaded] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured() || !db) return;
    return onSnapshot(query(collection(db, USERS_COLLECTION)), (snapshot) => {
      setPlayers(snapshot.docs.map((item) => userFromSnapshot(item.id, item.data() as Record<string, unknown>)).sort((a, b) => a.displayName.localeCompare(b.displayName)));
      setPlayersLoaded(true);
    }, () => setPlayersLoaded(true));
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured() || !db) return;
    return onSnapshot(query(collection(db, SESSIONS_COLLECTION)), (snapshot) => {
      setSessions(snapshot.docs.map((item) => sessionFromSnapshot(item.id, item.data() as Record<string, unknown>)).filter((session) => session.status === "active"));
      setSessionsLoaded(true);
    }, () => setSessionsLoaded(true));
  }, []);

  useEffect(() => {
    if (!sessions.length) {
      setSelectedSessionId("");
      return;
    }
    const nextId = sessions.some((session) => session.id === activeSessionId) ? activeSessionId ?? sessions[0].id : sessions[0].id;
    setSelectedSessionId(nextId);
    if (nextId !== activeSessionId) setActiveSessionId(nextId);
  }, [activeSessionId, sessions, setActiveSessionId]);

  useEffect(() => {
    if (message?.type !== "success") return;
    const timeout = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  const selectedSession = sessions.find((session) => session.id === selectedSessionId);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const playerRankById = useMemo(() => new Map([...players].sort((a, b) => b.displayRank - a.displayRank || b.mu - a.mu).map((player, index) => [player.id, index + 1])), [players]);
  const selectedIds = useMemo(() => ACTIVE_SLOTS[matchType].map((slot) => slots[slot]).filter(Boolean), [matchType, slots]);
  const selectablePlayers = useMemo(() => selectedSession ? players.filter((player) => selectedSession.playerIds.includes(player.id)) : players, [players, selectedSession]);
  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return selectablePlayers.filter((player) => {
      if (selectedIds.includes(player.id) && pickerSlot && slots[pickerSlot] !== player.id) return false;
      return !term || player.displayName.toLowerCase().includes(term);
    });
  }, [pickerSlot, search, selectablePlayers, selectedIds, slots]);

  function changeMatchType(nextType: MatchType) {
    setMatchType(nextType);
    setMessage(null);
    if (nextType === "1v1") setSlots((current) => ({ ...current, a2: "", b2: "" }));
  }

  async function submitMatch(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const activeSlots = ACTIVE_SLOTS[matchType];
    const ids = activeSlots.map((slot) => slots[slot]);
    if (ids.some((id) => !id)) return setMessage({ type: "error", text: t("errors.incomplete") });
    if (new Set(ids).size !== ids.length) return setMessage({ type: "error", text: t("errors.duplicate") });
    if (!isValidBadmintonScore(scoreA, scoreB)) return setMessage({ type: "error", text: t("errors.range") });

    setSubmitting(true);
    try {
      await recordMatch({
        matchType,
        teamAIds: matchType === "1v1" ? [slots.a1] : [slots.a1, slots.a2],
        teamBIds: matchType === "1v1" ? [slots.b1] : [slots.b1, slots.b2],
        scoreA,
        scoreB,
        sessionId: selectedSession?.id,
      });
      setSlots(EMPTY_SLOTS);
      setScoreA(21);
      setScoreB(19);
      setMessage({ type: "success", text: t("success") });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMessage({ type: "error", text: code === "DUPLICATE_PLAYERS" ? t("errors.duplicate") : code === "INVALID_SCORE_RANGE" ? t("errors.range") : t("errors.save") });
    } finally {
      setSubmitting(false);
    }
  }

  const scoreOutcome = scoreA === scoreB ? t("draw") : scoreA > scoreB ? t("winnerA") : t("winnerB");

  return (
    <section>
      <header className="px-1">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300"><Zap className="h-3.5 w-3.5 fill-emerald-300" /> Match center</div>
        <h1 className="mt-2 text-[2rem] font-black leading-none tracking-[-0.04em]">{t("title")}</h1>
        <p className="mt-2 text-sm text-slate-400">{t("subtitle")}</p>
      </header>

      {!configured || !user ? (
        <div className="mt-8 rounded-[2rem] border border-white/10 bg-slate-900/50 p-6 text-center backdrop-blur-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-300/10 text-emerald-300"><LogIn className="h-6 w-6" /></div>
          <p className="mt-4 text-sm text-slate-400">{tAuth("signInToRecord")}</p>
          <Button className="mt-5 w-full" onClick={() => signIn()}>{tAuth("signIn")}</Button>
        </div>
      ) : (
        !playersLoaded || !sessionsLoaded ? <LoadingIndicator className="min-h-80" label={t("loading")} /> : <form onSubmit={submitMatch} className="mt-6 space-y-5">
          <div>
            <label htmlFor="active-session" className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{tSession("selector")}</label>
            <div className="relative">
              <select id="active-session" value={selectedSessionId} onChange={(event) => { setSelectedSessionId(event.target.value); setActiveSessionId(event.target.value || null); }} className="h-14 w-full appearance-none rounded-2xl border border-white/10 bg-slate-900/70 px-4 pr-12 text-sm font-bold text-slate-100 outline-none backdrop-blur-xl focus:border-emerald-300/50 focus:ring-2 focus:ring-emerald-300/10">
                <option value="">{tSession("noSession")}</option>
                {sessions.map((session) => <option key={session.id} value={session.id}>{session.title}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-emerald-300" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Players on court</p>
            <div className="flex rounded-xl border border-white/10 bg-slate-900/70 p-1">
              {(["1v1", "2v2"] as const).map((option) => <button key={option} type="button" onClick={() => changeMatchType(option)} className={cn("relative rounded-lg px-3 py-1.5 text-xs font-black transition-colors", matchType === option ? "text-slate-950" : "text-slate-500")}><span className="relative z-10">{option}</span>{matchType === option && <motion.span layoutId="match-type" className="absolute inset-0 rounded-lg bg-emerald-300" />}</button>)}
            </div>
          </div>

          <BadmintonCourt matchType={matchType} slots={slots} playerById={playerById} onPick={setPickerSlot} labels={{ teamA: t("teamA"), teamB: t("teamB"), select: t("selectPlayer") }} />

          <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900/65 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{t("score")}</p>
                <p className="mt-0.5 text-sm font-extrabold text-slate-100">Final score</p>
              </div>
              <motion.span key={scoreOutcome} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} className="rounded-full bg-emerald-300/10 px-3 py-1.5 text-[10px] font-black text-emerald-300 ring-1 ring-emerald-300/15">{scoreOutcome}</motion.span>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 p-3">
              <ScorePanel team="A" label={t("teamA")} value={scoreA} onChange={setScoreA} tone="emerald" />
              <div className="flex w-7 flex-col items-center justify-center">
                <span className="h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
                <span className="my-2 text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">vs</span>
                <span className="h-full w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />
              </div>
              <ScorePanel team="B" label={t("teamB")} value={scoreB} onChange={setScoreB} tone="sky" />
            </div>

            <div className="border-t border-white/[0.06] px-3 py-3">
              <div className="flex items-center gap-2 overflow-x-auto">
                <span className="shrink-0 pl-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">Quick</span>
                {([[21, 10], [10, 21]] as const).map(([teamA, teamB]) => (
                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    key={`${teamA}-${teamB}`}
                    type="button"
                    onClick={() => { setScoreA(teamA); setScoreB(teamB); }}
                    className="min-h-9 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-black tabular-nums text-slate-300 transition-colors hover:bg-white/[0.08]"
                  >
                    {teamA}<span className="px-1 text-slate-600">–</span>{teamB}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>

          {message?.type === "error" && <p role="status" className="rounded-xl bg-rose-400/10 px-3 py-2 text-center text-xs font-bold text-rose-300">{message.text}</p>}
          <motion.button whileTap={{ scale: 0.97 }} type="submit" disabled={submitting} className="flex h-16 w-full items-center justify-center gap-2 rounded-[1.35rem] bg-emerald-300 text-base font-black text-slate-950 shadow-[0_0_32px_rgba(52,211,153,.3)] transition-colors hover:bg-emerald-200 disabled:opacity-50">
            {submitting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}{submitting ? t("submitting") : t("submit")}
          </motion.button>
        </form>
      )}

      <Dialog open={pickerSlot !== null} onOpenChange={(open) => { if (!open) { setPickerSlot(null); setSearch(""); } }}>
        <DialogContent>
          <DialogTitle className="text-xl font-black">{t("selectPlayer")}</DialogTitle>
          <DialogDescription className="text-sm text-slate-400">Choose a player for this court position.</DialogDescription>
          <div className="relative mt-4"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchPlayers")} className="pl-10" /></div>
          <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
            {!players.length ? <li className="px-2 py-8 text-center text-sm text-slate-400">{t("noPlayers")}</li> : !filteredPlayers.length ? <li className="px-2 py-8 text-center text-sm text-slate-400">{t("noPlayersFound")}</li> : filteredPlayers.map((player) => (
              <li key={player.id}><motion.button whileTap={{ scale: 0.98 }} type="button" onClick={() => { if (!pickerSlot) return; setSlots((current) => ({ ...current, [pickerSlot]: player.id })); setPickerSlot(null); setSearch(""); }} className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-white/5"><Avatar player={player} className="h-11 w-11 rounded-xl" /><span className="min-w-0 flex-1 truncate font-bold">{player.displayName}</span><span className="flex shrink-0 flex-col items-end gap-1"><RankBadge displayRank={playerRankById.get(player.id) ?? 0} matchesPlayed={player.matchesPlayed} /><span className="text-[10px] font-bold tabular-nums text-emerald-300">{player.displayRank} {t("points")}</span></span></motion.button></li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
      {message?.type === "success" ? <motion.div role="status" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-emerald-300/30 bg-slate-900/95 px-4 py-3 text-sm font-bold text-emerald-200 shadow-float backdrop-blur-xl"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-300" />{message.text}</motion.div> : null}
    </section>
  );
}

function BadmintonCourt({ matchType, slots, playerById, onPick, labels }: { matchType: MatchType; slots: Record<SlotKey, string>; playerById: Map<string, User>; onPick: (slot: SlotKey) => void; labels: { teamA: string; teamB: string; select: string } }) {
  return (
    <div className="relative aspect-[0.68] w-full overflow-hidden rounded-[1.6rem] border border-emerald-200/30 bg-[#08775b] p-4 shadow-[inset_0_0_55px_rgba(0,0,0,.38),0_20px_50px_rgba(0,0,0,.25)]">
      <div className="pointer-events-none absolute inset-3 border-2 border-white/80" />
      <div className="pointer-events-none absolute inset-y-3 left-[16%] border-l border-white/65" />
      <div className="pointer-events-none absolute inset-y-3 right-[16%] border-l border-white/65" />
      <div className="pointer-events-none absolute inset-x-3 top-[25%] border-t border-white/75" />
      <div className="pointer-events-none absolute inset-x-3 bottom-[25%] border-t border-white/75" />
      <div className="pointer-events-none absolute bottom-[25%] left-1/2 top-[25%] border-l border-white/65" />
      <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 h-2 -translate-y-1/2 border-y border-white/25 bg-slate-950/75 shadow-[0_4px_12px_rgba(0,0,0,.55)]"><div className="h-full w-full bg-[repeating-linear-gradient(90deg,transparent_0,transparent_6px,rgba(255,255,255,.22)_6px,rgba(255,255,255,.22)_7px)]" /></div>
      <span className="absolute left-6 top-5 text-[9px] font-black uppercase tracking-[0.2em] text-white/55">{labels.teamA}</span>
      <span className="absolute bottom-5 left-6 text-[9px] font-black uppercase tracking-[0.2em] text-white/55">{labels.teamB}</span>
      <div className="relative z-10 grid h-full grid-rows-2 gap-8 py-6">
        <div className={cn("grid items-center gap-3 px-5", matchType === "2v2" ? "grid-cols-2" : "grid-cols-1 px-20")}><CourtSlot slot="a1" player={playerById.get(slots.a1)} onPick={onPick} label={labels.select} />{matchType === "2v2" && <CourtSlot slot="a2" player={playerById.get(slots.a2)} onPick={onPick} label={labels.select} />}</div>
        <div className={cn("grid items-center gap-3 px-5", matchType === "2v2" ? "grid-cols-2" : "grid-cols-1 px-20")}><CourtSlot slot="b1" player={playerById.get(slots.b1)} onPick={onPick} label={labels.select} />{matchType === "2v2" && <CourtSlot slot="b2" player={playerById.get(slots.b2)} onPick={onPick} label={labels.select} />}</div>
      </div>
    </div>
  );
}

function CourtSlot({ slot, player, onPick, label }: { slot: SlotKey; player?: User; onPick: (slot: SlotKey) => void; label: string }) {
  return <motion.button whileTap={{ scale: 0.95 }} type="button" onClick={() => onPick(slot)} className={cn("mx-auto flex w-full max-w-32 flex-col items-center rounded-2xl border px-2 py-3 text-center shadow-lg backdrop-blur-md", player ? "border-white/35 bg-slate-950/65" : "border-dashed border-white/45 bg-slate-950/35")}><span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10">{player ? <Avatar player={player} className="h-full w-full rounded-full" /> : <UserPlus className="h-5 w-5 text-white/80" />}</span><span className="mt-2 w-full truncate text-[11px] font-black text-white">{player?.displayName ?? label}</span></motion.button>;
}

function ScorePanel({ team, label, value, onChange, tone }: { team: "A" | "B"; label: string; value: number; onChange: (value: number) => void; tone: "emerald" | "sky" }) {
  const accent = tone === "emerald" ? "bg-emerald-300 text-slate-950" : "bg-sky-300 text-slate-950";
  const border = tone === "emerald" ? "border-emerald-300/20 bg-emerald-300/[0.045]" : "border-sky-300/20 bg-sky-300/[0.045]";
  return (
    <div className={cn("overflow-hidden rounded-[1.3rem] border", border)}>
      <div className="flex items-center gap-2 px-3 pt-3">
        <span className={cn("flex h-6 w-6 items-center justify-center rounded-lg text-[10px] font-black", accent)}>{team}</span>
        <span className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{label}</span>
      </div>
      <input
        inputMode="numeric"
        aria-label={`${label} score`}
        value={value}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => onChange(Math.min(MAX_MATCH_SCORE, Math.max(MIN_MATCH_SCORE, Number.parseInt(event.target.value.replace(/\D/g, ""), 10) || 0)))}
        className="my-2 h-[4.6rem] w-full bg-transparent text-center text-6xl font-black tabular-nums tracking-[-0.06em] text-white outline-none selection:bg-emerald-300/30"
      />
      <div className="grid grid-cols-2 border-t border-white/[0.07]">
        <motion.button whileTap={{ scale: 0.9 }} type="button" aria-label={`${label} -1`} onClick={() => onChange(Math.max(MIN_MATCH_SCORE, value - 1))} className="flex min-h-11 items-center justify-center border-r border-white/[0.07] text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white"><Minus className="h-4 w-4" /></motion.button>
        <motion.button whileTap={{ scale: 0.9 }} type="button" aria-label={`${label} +1`} onClick={() => onChange(Math.min(MAX_MATCH_SCORE, value + 1))} className={cn("flex min-h-11 items-center justify-center transition-opacity hover:opacity-90", accent)}><Plus className="h-4 w-4" /></motion.button>
      </div>
    </div>
  );
}

function Avatar({ player, className }: { player: User; className?: string }) {
  return player.photoURL ? <img src={player.photoURL} alt="" className={cn("object-cover", className)} /> : <span className={cn("flex items-center justify-center bg-gradient-to-br from-emerald-200 to-emerald-600 font-black text-slate-950", className)}>{player.displayName.slice(0, 1).toUpperCase()}</span>;
}
