'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { routing, type AppLocale } from '@/i18n/routing';
import { usePathname, useRouter } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export function LanguageSwitcher() {
  const t = useTranslations('language');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function switchLocale(next: AppLocale) {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div
      role="group"
      aria-label={t('switchTo')}
      className="inline-flex rounded-full border border-slate-700 bg-slate-900 p-1"
    >
      {routing.locales.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            disabled={isPending}
            onClick={() => switchLocale(code)}
            aria-pressed={active}
            aria-label={t(code)}
            className={cn(
              'min-w-10 rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors',
              active ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-100'
            )}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
