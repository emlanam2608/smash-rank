'use client';

import { useTranslations } from 'next-intl';
import { AuthButton } from '@/components/AuthButton';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

export function AppHeader() {
  const t = useTranslations('app');

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-black tracking-tight text-white">{t('name')}</p>
          <p className="truncate text-xs text-slate-400">{t('tagline')}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <LanguageSwitcher />
          <AuthButton />
        </div>
      </div>
    </header>
  );
}
