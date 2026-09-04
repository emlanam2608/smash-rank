"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { Crown, Sparkles, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { USERS_COLLECTION, userFromSnapshot } from "@/lib/matches";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

type RankedPlayer = { player: User; place: number };

export function Leaderboard() {
  const t = useTranslations("leaderboard");
  const { user } = useAuth();
  const [players, setPlayers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured() || !db) {
      setLoading(false);
      setError(true);
      return;
    }
    return onSnapshot(
      query(collection(db, USERS_COLLECTION)),
      (snapshot) => {
        setPlayers(
          snapshot.docs
            .map((item) => userFromSnapshot(item.id, item.data() as Record<string, unknown>))
            .sort((a, b) => b.displayRank - a.displayRank || b.mu - a.mu),
        );
        setLoading(false);
        setError(false);
      },
      () => {
        setLoading(false);
        setError(true);
      },
    );
  }, []);

  const rows = useMemo<RankedPlayer[]>(
    () => players.slice(0, 100).map((player, index) => ({ player, place: index + 1 })),
    [players],
  );
  const currentUser = rows.find((row) => row.player.id === user?.uid);

  if (loading) return <LeaderboardSkeleton />;

  return (
    <section className="relative min-h-full pb-2">
      <header className="flex items-start justify-between px-1">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,.9)]" />
            {t("eyebrow")}
          </div>
          <h1 className="mt-2 text-[2rem] font-black leading-none tracking-[-0.04em]">{t("title")}</h1>
          <p className="mt-2 text-sm text-slate-400">{t("subtitle")}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
          <TrendingUp className="h-5 w-5" />
        </div>
      </header>

      {error || !rows.length ? (
        <div className="mt-8 rounded-[2rem] border border-dashed border-white/15 bg-white/[0.03] px-6 py-14 text-center text-sm text-slate-400">
          {error ? t("error") : t("empty")}
        </div>
      ) : (
        <>
          <div className="mt-9 grid grid-cols-3 items-end gap-2 px-1">
            {[rows[1], rows[0], rows[2]].filter(Boolean).map((row) => (
              <PodiumPlayer key={row.player.id} {...row} isCurrent={row.player.id === user?.uid} />
            ))}
          </div>

          <div className="mt-6 overflow-hidden rounded-[1.75rem] border border-white/10 bg-slate-900/55 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{t("allPlayers")}</span>
              <span className="rounded-full bg-white/[0.05] px-2 py-1 text-[10px] font-bold text-slate-400">Top 100</span>
            </div>
            <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.045 } } }}>
              {rows.slice(3).map((row) => (
                <RankingRow key={row.player.id} {...row} isCurrent={row.player.id === user?.uid} />
              ))}
            </motion.div>
          </div>

          {currentUser && (
            <div className="sticky bottom-0 z-20 -mx-1 mt-3 pt-3">
              <div className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent" />
              <div className="flex items-center gap-3 rounded-[1.35rem] border border-emerald-300/40 bg-slate-900/95 p-3 shadow-[0_12px_40px_rgba(0,0,0,.45),0_0_28px_rgba(16,185,129,.1)] backdrop-blur-2xl">
                <span className="w-8 text-center text-sm font-black text-emerald-300">#{currentUser.place}</span>
                <PlayerAvatar player={currentUser.player} className="h-11 w-11 rounded-xl ring-2 ring-emerald-300/50" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold">{currentUser.player.displayName}</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">{t("you")}</p>
                </div>
                <Points value={currentUser.player.displayRank} />
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

function PodiumPlayer({ player, place, isCurrent }: RankedPlayer & { isCurrent: boolean }) {
  const t = useTranslations("leaderboard");
  const first = place === 1;
  const tone = place === 1 ? "amber" : place === 2 ? "slate" : "orange";
  return (
    <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: place === 1 ? 0.05 : 0.12, type: "spring", stiffness: 180 }} className={cn("relative flex flex-col items-center", first && "-mt-5")}>
      {first && <Crown className="mb-1 h-7 w-7 fill-amber-300 text-amber-300 drop-shadow-[0_0_12px_rgba(252,211,77,.65)]" />}
      <div className={cn("relative rounded-full p-1", tone === "amber" && "bg-gradient-to-b from-amber-200 to-amber-500", tone === "slate" && "bg-gradient-to-b from-slate-100 to-slate-400", tone === "orange" && "bg-gradient-to-b from-orange-300 to-orange-600")}>
        <PlayerAvatar player={player} className={cn("rounded-full border-4 border-slate-950", first ? "h-[5.25rem] w-[5.25rem]" : "h-[4.25rem] w-[4.25rem]")} />
        <span className={cn("absolute -bottom-2 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full border-2 border-slate-950 text-[11px] font-black text-slate-950", first ? "h-7 w-7 bg-amber-300" : place === 2 ? "h-6 w-6 bg-slate-200" : "h-6 w-6 bg-orange-400")}>{place}</span>
      </div>
      <p className={cn("mt-4 w-full truncate text-center font-extrabold", first ? "text-sm" : "text-xs")}>{player.displayName}</p>
      <p className="mt-1 text-xs font-black tabular-nums text-emerald-300">{player.displayRank.toLocaleString()} <span className="text-[9px] uppercase text-slate-500">pts</span></p>
      <p className="mt-1 text-center text-[9px] font-bold tabular-nums text-slate-500">W-L {player.wins}-{player.losses} · {player.matchesPlayed} {t("matches")}</p>
      <div className={cn("mt-3 w-full rounded-t-xl border-x border-t", first ? "h-14 border-amber-300/30 bg-amber-300/10" : place === 2 ? "h-10 border-slate-300/20 bg-slate-300/[0.06]" : "h-8 border-orange-400/25 bg-orange-400/[0.06]")}>
        {isCurrent && <Sparkles className="mx-auto mt-2 h-4 w-4 text-emerald-300" />}
      </div>
    </motion.div>
  );
}

function RankingRow({ player, place, isCurrent }: RankedPlayer & { isCurrent: boolean }) {
  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className={cn("flex min-h-[4.5rem] items-center gap-3 border-b border-white/[0.05] px-3 last:border-0", isCurrent && "bg-emerald-300/[0.07]")}>
      <span className={cn("w-7 text-center text-sm font-black tabular-nums", isCurrent ? "text-emerald-300" : "text-slate-500")}>{place}</span>
      <PlayerAvatar player={player} className="h-10 w-10 rounded-xl ring-1 ring-white/10" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-slate-100">{player.displayName}</p>
        <p className="mt-0.5 text-[10px] font-medium text-slate-500">{player.matchesPlayed} matches · {winRate(player)}% WR</p>
      </div>
      <Points value={player.displayRank} />
    </motion.div>
  );
}

function Points({ value }: { value: number }) {
  return <div className="text-right"><p className="text-sm font-black tabular-nums text-slate-100">{value.toLocaleString()}</p><p className="text-[9px] font-black uppercase tracking-widest text-slate-500">points</p></div>;
}

function PlayerAvatar({ player, className }: { player: User; className?: string }) {
  return player.photoURL ? <img src={player.photoURL} alt={player.displayName} className={cn("shrink-0 object-cover", className)} /> : <div className={cn("flex shrink-0 items-center justify-center bg-gradient-to-br from-emerald-200 to-emerald-600 font-black text-slate-950", className)}>{player.displayName.slice(0, 1).toUpperCase()}</div>;
}

function winRate(player: User) {
  return player.matchesPlayed ? Math.round((player.wins / player.matchesPlayed) * 100) : 0;
}

function LeaderboardSkeleton() {
  return <section className="animate-pulse"><div className="h-20 rounded-3xl bg-white/5" /><div className="mt-8 grid grid-cols-3 items-end gap-2"><div className="h-40 rounded-t-3xl bg-white/5" /><div className="h-52 rounded-t-3xl bg-white/5" /><div className="h-36 rounded-t-3xl bg-white/5" /></div><div className="mt-6 h-72 rounded-[1.75rem] bg-white/5" /></section>;
}
