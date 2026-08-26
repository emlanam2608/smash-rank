'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PROVISIONAL_MATCHES = 5;

export function RankBadge({
  displayRank,
  matchesPlayed,
  className,
}: {
  displayRank: number;
  matchesPlayed: number;
  className?: string;
}) {
  const t = useTranslations('rank');
  const provisional = matchesPlayed < PROVISIONAL_MATCHES;

  return (
    <Badge
      aria-label={t('badgeAria', { value: displayRank })}
      className={cn(
        provisional
          ? 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30'
          : 'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30',
        className
      )}
      title={provisional ? t('provisional') : t('established')}
    >
      {t('label', { value: displayRank })}
    </Badge>
  );
}
