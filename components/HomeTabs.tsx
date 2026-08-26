'use client';

import { useTranslations } from 'next-intl';
import { ClipboardList, Trophy } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { Leaderboard } from '@/components/Leaderboard';
import { MatchForm } from '@/components/MatchForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function HomeTabs() {
  const tNav = useTranslations('nav');

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <AppHeader />
      <main className="mx-auto max-w-lg px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-4">
        <Tabs defaultValue="leaderboard">
          <TabsList aria-label={tNav('aria')}>
            <TabsTrigger value="leaderboard">
              <Trophy className="h-4 w-4" />
              {tNav('leaderboard')}
            </TabsTrigger>
            <TabsTrigger value="match">
              <ClipboardList className="h-4 w-4" />
              {tNav('recordMatch')}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="leaderboard">
            <Leaderboard />
          </TabsContent>
          <TabsContent value="match">
            <MatchForm />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
