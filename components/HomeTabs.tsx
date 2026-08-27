"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { BottomNav, type AppTab } from "@/components/BottomNav";
import { LeaderboardTab } from "@/components/tabs/LeaderboardTab";
import { PlayTab } from "@/components/tabs/PlayTab";
import { ProfileTab } from "@/components/tabs/ProfileTab";
import { SessionsTab } from "@/components/tabs/SessionsTab";

const tabOrder: AppTab[] = ["leaderboard", "play", "sessions", "profile"];

export function HomeTabs() {
  const [activeTab, setActiveTab] = useState<AppTab>("leaderboard");
  const [direction, setDirection] = useState(0);

  function selectTab(nextTab: AppTab) {
    if (nextTab === activeTab) return;
    setDirection(tabOrder.indexOf(nextTab) > tabOrder.indexOf(activeTab) ? 1 : -1);
    setActiveTab(nextTab);
  }

  return (
    <div className="relative mx-auto flex h-dvh w-full max-w-lg flex-col overflow-hidden bg-slate-950 text-slate-50 sm:my-4 sm:h-[calc(100dvh-2rem)] sm:rounded-[2.25rem] sm:border sm:border-white/10 sm:shadow-2xl">
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false} mode="popLayout" custom={direction}>
          <motion.div
            key={activeTab}
            custom={direction}
            variants={{
              enter: (travel: number) => ({ opacity: 0, x: travel * 28, scale: 0.985 }),
              center: { opacity: 1, x: 0, scale: 1 },
              exit: (travel: number) => ({ opacity: 0, x: travel * -20, scale: 0.99 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 overflow-y-auto overscroll-contain px-4 pb-32 pt-[max(1.25rem,env(safe-area-inset-top))]"
          >
            {activeTab === "leaderboard" && <LeaderboardTab />}
            {activeTab === "play" && <PlayTab />}
            {activeTab === "sessions" && <SessionsTab />}
            {activeTab === "profile" && <ProfileTab />}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav activeTab={activeTab} onChange={selectTab} />
    </div>
  );
}
