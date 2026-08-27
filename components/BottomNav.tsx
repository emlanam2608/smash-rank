"use client";

import { CalendarDays, Swords, Trophy, UserRound } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type AppTab = "leaderboard" | "play" | "sessions" | "profile";

type NavItem = {
  id: AppTab;
  label: string;
  icon: typeof Trophy;
  featured?: boolean;
};

export function BottomNav({
  activeTab,
  onChange,
}: {
  activeTab: AppTab;
  onChange: (tab: AppTab) => void;
}) {
  const t = useTranslations("nav");
  const items: NavItem[] = [
    { id: "leaderboard", label: t("leaderboard"), icon: Trophy },
    { id: "play", label: t("play"), icon: Swords, featured: true },
    { id: "sessions", label: t("activeSession"), icon: CalendarDays },
    { id: "profile", label: t("profile"), icon: UserRound },
  ];

  return (
    <nav
      aria-label={t("aria")}
      className="absolute inset-x-0 bottom-0 z-40 border-t border-white/10 bg-slate-950/88 px-2 pb-[max(.6rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-20px_50px_rgba(2,6,23,.82)] backdrop-blur-2xl"
    >
      <div className="grid grid-cols-4 items-end">
        {items.map((item) => (
          <NavButton key={item.id} item={item} active={activeTab === item.id} onChange={onChange} />
        ))}
      </div>
    </nav>
  );
}

function NavButton({ item, active, onChange }: { item: NavItem; active: boolean; onChange: (tab: AppTab) => void }) {
  const Icon = item.icon;

  if (item.featured) {
    return (
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={() => onChange(item.id)}
        aria-current={active ? "page" : undefined}
        aria-label={item.label}
        className="group -mt-9 flex min-h-[4.25rem] flex-col items-center justify-end gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-emerald-300"
      >
        <motion.span
          animate={{ y: active ? -3 : 0, rotate: active ? -3 : 0 }}
          className={cn(
            "relative flex h-[4.15rem] w-[4.15rem] items-center justify-center rounded-[1.6rem] border-[5px] border-slate-950 bg-emerald-400 text-slate-950 shadow-[0_0_0_1px_rgba(52,211,153,.28),0_14px_36px_rgba(16,185,129,.36)]",
            active && "bg-emerald-300",
          )}
        >
          <span className="absolute inset-1 rounded-[1.15rem] border border-white/30" />
          <Icon className="relative h-7 w-7" strokeWidth={2.5} />
        </motion.span>
        <span>{item.label}</span>
      </motion.button>
    );
  }

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={() => onChange(item.id)}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-[3.75rem] flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-bold transition-colors",
        active ? "text-emerald-300" : "text-slate-500 hover:text-slate-300",
      )}
    >
      {active && <motion.span layoutId="bottom-nav-indicator" className="absolute -top-2 h-1 w-7 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(52,211,153,.8)]" />}
      <Icon className="h-[1.3rem] w-[1.3rem]" strokeWidth={active ? 2.5 : 2} />
      <span>{item.label}</span>
    </motion.button>
  );
}
