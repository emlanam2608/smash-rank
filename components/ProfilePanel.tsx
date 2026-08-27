"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { BarChart3, Gamepad2, LogIn, LogOut, ShieldCheck, Trophy, TrendingDown, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { RankBadge } from "@/components/RankBadge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/firebase";
import { USERS_COLLECTION, userFromSnapshot } from "@/lib/matches";
import type { User } from "@/lib/types";

export function ProfilePanel() {
  const t = useTranslations("profile");
  const { user, loading, configured, signIn, signOutUser } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);

  useEffect(() => {
    if (!db || !user) {
      setProfile(null);
      return;
    }
    return onSnapshot(doc(db, USERS_COLLECTION, user.uid), (snapshot) => {
      setProfile(snapshot.exists() ? userFromSnapshot(snapshot.id, snapshot.data() as Record<string, unknown>) : null);
    });
  }, [user]);

  if (!configured) return null;
  if (loading) return <div className="h-80 animate-pulse rounded-[2rem] bg-white/5" />;
  if (!user) {
    return <div className="rounded-[2rem] border border-white/10 bg-slate-900/50 p-7 text-center"><ShieldCheck className="mx-auto h-9 w-9 text-emerald-300" /><h1 className="mt-4 text-2xl font-black">{t("title")}</h1><p className="mt-2 text-sm text-slate-400">{t("signInPrompt")}</p><Button className="mt-6 w-full" onClick={() => signIn()}><LogIn className="h-4 w-4" />{t("signIn")}</Button></div>;
  }

  const matches = profile?.matchesPlayed ?? 0;
  const wins = profile?.wins ?? 0;
  const losses = profile?.losses ?? 0;
  const stats = [
    { label: t("matches"), value: matches, icon: Gamepad2, tone: "text-sky-300 bg-sky-300/10" },
    { label: t("winRate"), value: `${matches ? Math.round((wins / matches) * 100) : 0}%`, icon: BarChart3, tone: "text-violet-300 bg-violet-300/10" },
    { label: t("wins"), value: wins, icon: TrendingUp, tone: "text-emerald-300 bg-emerald-300/10" },
    { label: t("losses"), value: losses, icon: TrendingDown, tone: "text-rose-300 bg-rose-300/10" },
  ];

  return (
    <section className="min-h-full pb-2">
      <header className="px-1">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-emerald-300">Player dashboard</p>
        <h1 className="mt-2 text-[2rem] font-black leading-none tracking-[-0.04em]">{t("title")}</h1>
      </header>

      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="relative mt-7 overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/60 p-5 backdrop-blur-xl">
        <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="relative shrink-0">
            {user.photoURL ? <img src={user.photoURL} alt={user.displayName ?? ""} className="h-24 w-24 rounded-[1.65rem] object-cover ring-2 ring-emerald-300/50" /> : <div className="flex h-24 w-24 items-center justify-center rounded-[1.65rem] bg-gradient-to-br from-emerald-200 to-emerald-600 text-4xl font-black text-slate-950 ring-2 ring-emerald-300/50">{user.displayName?.slice(0, 1).toUpperCase()}</div>}
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-4 border-slate-900 bg-emerald-300"><ShieldCheck className="h-3.5 w-3.5 text-slate-950" /></span>
          </div>
          <div className="relative min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Competitor</p>
            <h2 className="mt-1 truncate text-2xl font-black tracking-tight">{user.displayName}</h2>
            {profile && <div className="mt-3"><RankBadge displayRank={profile.displayRank} matchesPlayed={profile.matchesPlayed} /></div>}
          </div>
        </div>
        <div className="relative mt-5 flex items-center justify-between rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] px-4 py-3">
          <div className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-300" /><span className="text-xs font-bold text-slate-300">TrueSkill points</span></div>
          <span className="text-lg font-black tabular-nums text-amber-200">{profile?.displayRank ?? 0}</span>
        </div>
      </motion.div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + index * 0.05 }} className="min-h-36 rounded-[1.5rem] border border-white/10 bg-slate-900/50 p-4 backdrop-blur-xl"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.tone}`}><Icon className="h-4 w-4" /></span><p className="mt-5 text-3xl font-black tabular-nums tracking-tight">{stat.value}</p><p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">{stat.label}</p></motion.div>;
        })}
      </div>

      <motion.button whileTap={{ scale: 0.97 }} type="button" onClick={() => signOutUser()} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] text-sm font-black text-rose-300 transition-colors hover:bg-rose-400/10"><LogOut className="h-4 w-4" />{t("signOut")}</motion.button>
    </section>
  );
}
