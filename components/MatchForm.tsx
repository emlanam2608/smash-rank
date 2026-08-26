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
import { db, isFirebaseConfigured } from "@/lib/firebase";
import {
  recordDoublesMatch,
  USERS_COLLECTION,
  userFromSnapshot,
} from "@/lib/matches";
import { MAX_MATCH_SCORE, MIN_MATCH_SCORE } from "@/lib/trueskill";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

type SlotKey = "a1" | "a2" | "b1" | "b2";

const EMPTY_SLOTS: Record<SlotKey, string> = {
  a1: "",
  a2: "",
  b1: "",
  b2: "",
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
            const parsed = Number.parseInt(
              event.target.value.replace(/\D/g, ""),
              10,
            );
            if (Number.isNaN(parsed)) {
              onChange(0);
              return;
            }
            onChange(
              Math.min(MAX_MATCH_SCORE, Math.max(MIN_MATCH_SCORE, parsed)),
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
  const { user, configured } = useAuth();
  const [players, setPlayers] = useState<User[]>([]);
  const [slots, setSlots] = useState(EMPTY_SLOTS);
  const [scoreA, setScoreA] = useState(21);
  const [scoreB, setScoreB] = useState(19);
  const [pickerSlot, setPickerSlot] = useState<SlotKey | null>(null);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured() || !db) return;
    const unsubscribe = onSnapshot(
      query(collection(db, USERS_COLLECTION)),
      (snapshot) => {
        const next = snapshot.docs
          .map((docSnap) =>
            userFromSnapshot(
              docSnap.id,
              docSnap.data() as Record<string, unknown>,
            ),
          )
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
        setPlayers(next);
      },
    );
    return unsubscribe;
  }, []);

  const selectedIds = useMemo(
    () => Object.values(slots).filter(Boolean),
    [slots],
  );
  const playerById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );

  const filteredPlayers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return players.filter((player) => {
      if (
        selectedIds.includes(player.id) &&
        pickerSlot &&
        slots[pickerSlot] !== player.id
      ) {
        return false;
      }
      if (!term) return true;
      return player.displayName.toLowerCase().includes(term);
    });
  }, [players, search, selectedIds, pickerSlot, slots]);

  function assignPlayer(slot: SlotKey, userId: string) {
    setSlots((current) => ({ ...current, [slot]: userId }));
    setPickerSlot(null);
    setSearch("");
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    const teamAIds = [slots.a1, slots.a2] as [string, string];
    const teamBIds = [slots.b1, slots.b2] as [string, string];
    const allIds = [...teamAIds, ...teamBIds];

    if (allIds.some((id) => !id)) {
      setMessage({ type: "error", text: t("errors.incomplete") });
      return;
    }
    if (new Set(allIds).size !== 4) {
      setMessage({ type: "error", text: t("errors.duplicate") });
      return;
    }
    if (scoreA === scoreB) {
      setMessage({ type: "error", text: t("errors.tie") });
      return;
    }
    if (
      scoreA < MIN_MATCH_SCORE ||
      scoreB < MIN_MATCH_SCORE ||
      scoreA > MAX_MATCH_SCORE ||
      scoreB > MAX_MATCH_SCORE
    ) {
      setMessage({ type: "error", text: t("errors.range") });
      return;
    }

    setSubmitting(true);
    try {
      await recordDoublesMatch({ teamAIds, teamBIds, scoreA, scoreB });
      setSlots(EMPTY_SLOTS);
      setScoreA(21);
      setScoreB(19);
      setMessage({ type: "success", text: t("success") });
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "DUPLICATE_PLAYERS") {
        setMessage({ type: "error", text: t("errors.duplicate") });
      } else if (code === "TIE") {
        setMessage({ type: "error", text: t("errors.tie") });
      } else if (code === "INVALID_SCORE_RANGE") {
        setMessage({ type: "error", text: t("errors.range") });
      } else {
        setMessage({ type: "error", text: t("errors.save") });
      }
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
        className={cn(
          "flex w-full items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-left",
          selected ? "text-slate-100" : "text-slate-500",
        )}
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {label}
          </span>
          <span className="block truncate font-medium">
            {selected ? selected.displayName : t("selectPlayer")}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
      </button>
    );
  }

  const winnerPreview =
    scoreA === scoreB ? null : scoreA > scoreB ? t("winnerA") : t("winnerB");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {!configured || !user ? (
          <p className="py-6 text-center text-sm text-slate-400">
            {tAuth("signInToRecord")}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 rounded-2xl bg-slate-950/60 p-3 ring-1 ring-slate-800">
                <p className="text-sm font-bold text-emerald-400">
                  {t("teamA")}
                </p>
                <PlayerField slot="a1" label={t("player1")} />
                <PlayerField slot="a2" label={t("player2")} />
              </div>
              <div className="space-y-2 rounded-2xl bg-slate-950/60 p-3 ring-1 ring-slate-800">
                <p className="text-sm font-bold text-sky-400">{t("teamB")}</p>
                <PlayerField slot="b1" label={t("player1")} />
                <PlayerField slot="b2" label={t("player2")} />
              </div>
            </div>

            <div className="flex items-end justify-center gap-6">
              <ScoreStepper
                label={t("scoreA")}
                value={scoreA}
                onChange={setScoreA}
              />
              <span className="pb-4 text-xl font-black text-slate-500">–</span>
              <ScoreStepper
                label={t("scoreB")}
                value={scoreB}
                onChange={setScoreB}
              />
            </div>

            {winnerPreview ? (
              <p className="text-center text-sm font-semibold text-emerald-400">
                {winnerPreview}
              </p>
            ) : null}

            {message ? (
              <p
                className={cn(
                  "text-center text-sm",
                  message.type === "success"
                    ? "text-emerald-400"
                    : "text-rose-400",
                )}
                role="status"
              >
                {message.text}
              </p>
            ) : null}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitting}
            >
              {submitting ? t("submitting") : t("submit")}
            </Button>
          </form>
        )}

        <Dialog
          open={pickerSlot !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPickerSlot(null);
              setSearch("");
            }
          }}
        >
          <DialogContent>
            <DialogTitle>{t("selectPlayer")}</DialogTitle>
            <DialogDescription>{t("searchPlayers")}</DialogDescription>
            <Input
              autoFocus
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlayers")}
              className="mt-3"
            />
            <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto">
              {players.length === 0 ? (
                <li className="px-2 py-6 text-center text-sm text-slate-400">
                  {t("noPlayers")}
                </li>
              ) : filteredPlayers.length === 0 ? (
                <li className="px-2 py-6 text-center text-sm text-slate-400">
                  {t("noPlayersFound")}
                </li>
              ) : (
                filteredPlayers.map((player) => (
                  <li key={player.id}>
                    <button
                      type="button"
                      onClick={() =>
                        pickerSlot && assignPlayer(pickerSlot, player.id)
                      }
                      className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-slate-900"
                    >
                      <span className="truncate font-medium">
                        {player.displayName}
                      </span>
                      <RankBadge
                        displayRank={player.displayRank}
                        matchesPlayed={player.matchesPlayed}
                      />
                    </button>
                  </li>
                ))
              )}
            </ul>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
