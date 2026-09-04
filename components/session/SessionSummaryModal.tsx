"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { LoaderCircle, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/context/SessionContext";
import { db } from "@/lib/firebase";
import { closeSession } from "@/lib/firebase/sessions";
import { MATCHES_COLLECTION } from "@/lib/matches";
import type { Match, Session } from "@/lib/types";

export function SessionSummaryModal({
  session,
  open,
  onOpenChange,
}: {
  session: Session;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("session");
  const { setActiveSessionId } = useSession();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db || !open) return;
    setLoadingMatches(true);
    return onSnapshot(
      query(collection(db, MATCHES_COLLECTION), where("sessionId", "==", session.id)),
      (snapshot) => {
        setMatches(
          snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Match),
        );
        setLoadingMatches(false);
      },
      () => setLoadingMatches(false),
    );
  }, [open, session.id]);

  const standings = useMemo(() => {
    const players = new Map<string, { displayName: string; gain: number; wins: number; losses: number }>();
    for (const match of matches) {
      for (const member of match.teamA) {
        const current = players.get(member.userId) ?? { displayName: member.displayName ?? member.userId, gain: 0, wins: 0, losses: 0 };
        current.gain += member.postRank - member.preRank;
        if (match.winner === "teamA") current.wins += 1;
        if (match.winner === "teamB") current.losses += 1;
        players.set(member.userId, current);
      }
      for (const member of match.teamB) {
        const current = players.get(member.userId) ?? { displayName: member.displayName ?? member.userId, gain: 0, wins: 0, losses: 0 };
        current.gain += member.postRank - member.preRank;
        if (match.winner === "teamB") current.wins += 1;
        if (match.winner === "teamA") current.losses += 1;
        players.set(member.userId, current);
      }
    }
    return [...players.entries()].sort(([, a], [, b]) => b.gain - a.gain);
  }, [matches]);

  const nameFor = (_id: string, displayName: string) => displayName;

  async function handleClose() {
    setBusy(true);
    setError(null);
    try {
      await closeSession(session.id);
      setActiveSessionId(null);
      onOpenChange(false);
    } catch {
      setError(t("errors.close"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{t("summaryTitle")}</DialogTitle>
        <DialogDescription>{session.title}</DialogDescription>
        <div className="mt-4 space-y-4">
          {loadingMatches ? <LoadingIndicator label={t("loading")} /> : null}
          <p className="rounded-xl bg-slate-900 px-3 py-2 text-center text-sm font-semibold">{t("totalMatches", { count: matches.length })}</p>
          <div>
            <p className="mb-2 flex items-center gap-2 font-semibold"><Trophy className="h-4 w-4 text-gold" />{t("mvp")}</p>
            {standings.length ? <ol className="space-y-2">{standings.slice(0, 3).map(([id, stats], index) => <li key={id} className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2 text-sm"><span>{index + 1}. {nameFor(id, stats.displayName)}</span><span className="font-semibold text-emerald-400">+{stats.gain}</span></li>)}</ol> : <p className="text-sm text-slate-400">{t("noMatches")}</p>}
          </div>
          <div>
            <p className="mb-2 font-semibold">{t("sessionRecords")}</p>
            <ul className="space-y-1">{standings.map(([id, stats]) => <li key={id} className="flex justify-between text-sm text-slate-300"><span>{nameFor(id, stats.displayName)}</span><span>{stats.wins}–{stats.losses}</span></li>)}</ul>
          </div>
          {session.status === "active" ? <Button className="w-full" variant="destructive" onClick={handleClose} disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{busy ? t("closing") : t("confirmClose")}</Button> : null}
          {error ? <p className="text-center text-sm text-rose-400">{error}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
