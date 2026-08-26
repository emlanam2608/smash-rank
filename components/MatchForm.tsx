"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { RankBadge } from "@/components/RankBadge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSession } from "@/context/SessionContext";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { recordMatch, USERS_COLLECTION, userFromSnapshot } from "@/lib/matches";
import { sessionFromSnapshot, SESSIONS_COLLECTION } from "@/lib/sessions";
import {
  MAX_MATCH_SCORE,
  MIN_MATCH_SCORE,
} from "@/lib/trueskill";
import type { MatchType, Session, User } from "@/lib/types";
import { cn } from "@/lib/utils";

type SlotKey = "a1" | "a2" | "b1" | "b2";

const EMPTY_SLOTS: Record<SlotKey, string> = {
  a1: "",
  a2: "",
  b1: "",
  b2: "",
};

const ACTIVE_SLOTS: Record<MatchType, SlotKey[]> = {
  "1v1": ["a1", "b1"],
  "2v2": ["a1", "a2", "b1", "b2"],
};

function ScoreStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={`${label} -1`}
          onClick={() => onChange(Math.max(MIN_MATCH_SCORE, value - 1))}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <input
          inputMode="numeric"
          aria-label={label}
          value={value}
          onChange={(event) => {
            const parsed = Number.parseInt(event.target.value.replace(/\D/g, ""), 10);
            onChange(
              Number.isNaN(parsed)
                ? MIN_MATCH_SCORE
                : Math.min(MAX_MATCH_SCORE, Math.max(MIN_MATCH_SCORE, parsed)),
            );
          }}
          className="h-14 w-16 rounded-xl border border-slate-700 bg-slate-950 text-center text-2xl font-bold tabular-nums"
        />
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label={`${label} +1`}
          onClick={() => onChange(Math.min(MAX_MATCH_SCORE, value + 1))}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function MatchForm() {
  const t = useTranslations("match");
  const tAuth = useTranslations("auth");
  const tSession = useTranslations("session");
  const { user, configured } = useAuth();
  const { activeSessionId, setActiveSessionId } = useSession();
  const [players, setPlayers] = useState<User[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [matchType, setMatchType] = useState<MatchType>("2v2");
  const [slots, setSlots] = useState(EMPTY_SLOTS);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [pickerSlot, setPickerSlot] = useState<SlotKey | null>(null);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured() || !db) return;
    return onSnapshot(query(collection(db, USERS_COLLECTION)), (snapshot) => {
      setPlayers(
        snapshot.docs
          .map((docSnap) => userFromSnapshot(docSnap.id, docSnap.data() as Record<string, unknown>))
          .sort((a, b) => a.displayName.localeCompare(b.displayName)),
      );
    });
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured() || !db) return;
    return onSnapshot(query(collection(db, SESSIONS_COLLECTION)), (snapshot) => {
      const next = snapshot.docs
        .map((docSnap) =>
          sessionFromSnapshot(
            docSnap.id,
            docSnap.data() as Record<string, unknown>,
          ),
        )
        .filter((session) => session.status === "active")
        .sort((a, b) => {
          const aCreatedAt =
            a.createdAt && typeof (a.createdAt as { toMillis?: unknown }).toMillis === "function"
              ? (a.createdAt as { toMillis: () => number }).toMillis()
              : 0;
          const bCreatedAt =
            b.createdAt && typeof (b.createdAt as { toMillis?: unknown }).toMillis === "function"
              ? (b.createdAt as { toMillis: () => number }).toMillis()
              : 0;
          return bCreatedAt - aCreatedAt;
        });
      setSessions(next);
    });
  }, []);

  useEffect(() => {
    if (!sessions.length) {
      setSelectedSessionId("");
      return;
    }
    const nextId = sessions.some((session) => session.id === activeSessionId)
      ? activeSessionId ?? sessions[0].id
      : sessions[0].id;
    setSelectedSessionId(nextId);
    if (nextId !== activeSessionId) setActiveSessionId(nextId);
  }, [activeSessionId, sessions, setActiveSessionId]);

  const selectedIds = useMemo(
    () => ACTIVE_SLOTS[matchType].map((slot) => slots[slot]).filter(Boolean),
    [matchType, slots],
  );
  const selectedSession = sessions.find((session) => session.id === selectedSessionId);
  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const selectablePlayers = useMemo(
    () =>
      selectedSession && !showAllPlayers
        ? players.filter((player) => selectedSession.playerIds.includes(player.id))
        : players,
    [players, selectedSession, showAllPlayers],
  );
  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return selectablePlayers.filter((player) => {
      if (selectedIds.includes(player.id) && pickerSlot && slots[pickerSlot] !== player.id) return false;
      return !term || player.displayName.toLowerCase().includes(term);
    });
  }, [pickerSlot, search, selectablePlayers, selectedIds, slots]);

  function changeMatchType(nextType: MatchType) {
    setMatchType(nextType);
    setPickerSlot(null);
    setSearch("");
    setMessage(null);
    if (nextType === "1v1") setSlots((current) => ({ ...current, a2: "", b2: "" }));
  }

  function assignPlayer(slot: SlotKey, userId: string) {
    setSlots((current) => ({ ...current, [slot]: userId }));
    setPickerSlot(null);
    setSearch("");
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    const teamAIds = matchType === "1v1" ? [slots.a1] : [slots.a1, slots.a2];
    const teamBIds = matchType === "1v1" ? [slots.b1] : [slots.b1, slots.b2];
    const allIds = [...teamAIds, ...teamBIds];
    if (allIds.some((id) => !id)) {
      setMessage({ type: "error", text: t("errors.incomplete") });
      return;
    }
    if (new Set(allIds).size !== allIds.length) {
      setMessage({ type: "error", text: t("errors.duplicate") });
      return;
    }
    if (scoreA < MIN_MATCH_SCORE || scoreB < MIN_MATCH_SCORE || scoreA > MAX_MATCH_SCORE || scoreB > MAX_MATCH_SCORE) {
      setMessage({ type: "error", text: t("errors.range") });
      return;
    }

    setSubmitting(true);
    try {
      await recordMatch({
        matchType,
        teamAIds,
        teamBIds,
        scoreA,
        scoreB,
        sessionId: selectedSession?.id,
      });
      setSlots(EMPTY_SLOTS);
      setScoreA(0);
      setScoreB(0);
      setMessage({ type: "success", text: t("success") });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      setMessage({
        type: "error",
        text: code === "DUPLICATE_PLAYERS" ? t("errors.duplicate") : code === "INVALID_SCORE_RANGE" ? t("errors.range") : t("errors.save"),
      });
    } finally {
      setSubmitting(false);
    }
  }

  function PlayerField({ slot, label }: { slot: SlotKey; label: string }) {
    const selected = playerById.get(slots[slot]);
    return (
      <button
        type="button"
        onClick={() => setPickerSlot(slot)}
        className={cn("flex w-full items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-left", selected ? "text-slate-100" : "text-slate-500")}
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
          <span className="block truncate font-medium">{selected ? selected.displayName : t("selectPlayer")}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
      </button>
    );
  }

  const outcomePreview = scoreA === scoreB ? t("draw") : scoreA > scoreB ? t("winnerA") : t("winnerB");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {!configured || !user ? (
          <p className="py-6 text-center text-sm text-slate-400">{tAuth("signInToRecord")}</p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              {selectedSession ? <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-300">{tSession("activeIndicator", { title: selectedSession.title })}</div> : null}
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-400" htmlFor="session-selector">
                {tSession("selector")}
              </label>
              <select
                id="session-selector"
                value={selectedSessionId}
                onChange={(event) => {
                  setSelectedSessionId(event.target.value);
                  setActiveSessionId(event.target.value || null);
                  setShowAllPlayers(false);
                }}
                className="flex h-11 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 text-base text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                <option value="">{tSession("noSession")}</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title}
                  </option>
                ))}
              </select>
              {selectedSession ? (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={showAllPlayers}
                    onChange={(event) => setShowAllPlayers(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 accent-emerald-500"
                  />
                  {tSession("showAllPlayers")}
                </label>
              ) : null}
              {selectedSession && !showAllPlayers ? (
                <p className="text-xs text-slate-400">{tSession("filterHint")}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-950/60 p-1 ring-1 ring-slate-800" role="radiogroup" aria-label={t("matchType")}>
              {(["1v1", "2v2"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={matchType === option}
                  onClick={() => changeMatchType(option)}
                  className={cn("rounded-xl px-3 py-2 text-sm font-semibold transition-colors", matchType === option ? "bg-emerald-500 text-slate-950" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100")}
                >
                  {t(option)}
                </button>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 rounded-2xl bg-slate-950/60 p-3 ring-1 ring-slate-800">
                <p className="text-sm font-bold text-emerald-400">{t("teamA")}</p>
                <PlayerField slot="a1" label={t("player1")} />
                {matchType === "2v2" ? <PlayerField slot="a2" label={t("player2")} /> : null}
              </div>
              <div className="space-y-2 rounded-2xl bg-slate-950/60 p-3 ring-1 ring-slate-800">
                <p className="text-sm font-bold text-sky-400">{t("teamB")}</p>
                <PlayerField slot="b1" label={t("player1")} />
                {matchType === "2v2" ? <PlayerField slot="b2" label={t("player2")} /> : null}
              </div>
            </div>

            <div className="flex items-end justify-center gap-6">
              <ScoreStepper label={t("scoreA")} value={scoreA} onChange={setScoreA} />
              <span className="pb-4 text-xl font-black text-slate-500">–</span>
              <ScoreStepper label={t("scoreB")} value={scoreB} onChange={setScoreB} />
            </div>

            <p className="text-center text-sm font-semibold text-emerald-400">{outcomePreview}</p>
            {message ? <p className={cn("text-center text-sm", message.type === "success" ? "text-emerald-400" : "text-rose-400")} role="status">{message.text}</p> : null}
            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              {submitting ? t("submitting") : t("submit")}
            </Button>
          </form>
        )}

        <Dialog open={pickerSlot !== null} onOpenChange={(open) => { if (!open) { setPickerSlot(null); setSearch(""); } }}>
          <DialogContent>
            <DialogTitle>{t("selectPlayer")}</DialogTitle>
            <DialogDescription>{t("searchPlayers")}</DialogDescription>
            <Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("searchPlayers")} className="mt-3" />
            <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
              {players.length === 0 ? <li className="px-2 py-6 text-center text-sm text-slate-400">{t("noPlayers")}</li> : filteredPlayers.length === 0 ? <li className="px-2 py-6 text-center text-sm text-slate-400">{t("noPlayersFound")}</li> : filteredPlayers.map((player) => (
                <li key={player.id}>
                  <button type="button" onClick={() => pickerSlot && assignPlayer(pickerSlot, player.id)} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-900">
                    <span className="truncate font-medium">{player.displayName}</span>
                    <RankBadge displayRank={player.displayRank} matchesPlayed={player.matchesPlayed} />
                  </button>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
