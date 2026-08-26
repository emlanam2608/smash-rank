"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { Crown, Medal, Trophy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { RankBadge } from "@/components/RankBadge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { USERS_COLLECTION, userFromSnapshot } from "@/lib/matches";
import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

function TopIcon({ place }: { place: number }) {
  if (place === 1) return <Crown className="h-5 w-5 text-gold" />;
  if (place === 2) return <Medal className="h-5 w-5 text-silver" />;
  return <Trophy className="h-5 w-5 text-bronze" />;
}

export function Leaderboard() {
  const t = useTranslations("leaderboard");
  const { user } = useAuth();
  const [players, setPlayers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured() || !db) {
      setLoading(false);
      setError(t("error"));
      return;
    }

    const usersQuery = query(collection(db, USERS_COLLECTION));
    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const next = snapshot.docs
          .map((docSnap) =>
            userFromSnapshot(
              docSnap.id,
              docSnap.data() as Record<string, unknown>,
            ),
          )
          .sort((a, b) => b.displayRank - a.displayRank || b.mu - a.mu);
        setPlayers(next);
        setLoading(false);
        setError(null);
      },
      () => {
        setError(t("error"));
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [t]);

  const rows = useMemo(
    () =>
      players.map((player, index) => ({
        player,
        place: index + 1,
      })),
    [players],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {t("loading")}
          </p>
        ) : error ? (
          <p className="py-8 text-center text-sm text-rose-400">{error}</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {t("empty")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[20rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-2 font-semibold">{t("rank")}</th>
                  <th className="py-2 pr-2 font-semibold">{t("player")}</th>
                  <th className="py-2 pr-2 font-semibold">{t("rating")}</th>
                  <th className="hidden py-2 pr-2 font-semibold sm:table-cell">
                    {t("matches")}
                  </th>
                  <th className="py-2 font-semibold">{t("winRate")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ player, place }) => {
                  const isYou = user?.uid === player.id;
                  const winRate =
                    player.matchesPlayed > 0
                      ? Math.round((player.wins / player.matchesPlayed) * 100)
                      : 0;
                  return (
                    <tr
                      key={player.id}
                      className={cn(
                        "border-b border-slate-800/80 last:border-0",
                        isYou && "bg-emerald-500/5",
                      )}
                    >
                      <td className="py-3 pr-2 align-middle">
                        <div className="flex items-center gap-1.5">
                          {place <= 3 ? (
                            <span
                              className="inline-flex"
                              title={
                                place === 1
                                  ? t("top1")
                                  : place === 2
                                    ? t("top2")
                                    : t("top3")
                              }
                            >
                              <TopIcon place={place} />
                            </span>
                          ) : (
                            <span className="w-5 text-center font-semibold text-slate-400">
                              {place}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-2 align-middle">
                        <div className="flex items-center gap-2">
                          {player.photoURL ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={player.photoURL}
                              alt=""
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-emerald-300">
                              {player.displayName.slice(0, 1).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {player.displayName}
                            </p>
                            {isYou ? (
                              <p className="text-[11px] font-semibold uppercase text-emerald-400">
                                {t("you")}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-2 align-middle">
                        <RankBadge
                          displayRank={player.displayRank}
                          matchesPlayed={player.matchesPlayed}
                        />
                      </td>
                      <td className="hidden py-3 pr-2 align-middle tabular-nums text-slate-300 sm:table-cell">
                        {player.matchesPlayed}
                      </td>
                      <td className="py-3 align-middle tabular-nums text-slate-300">
                        {winRate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
