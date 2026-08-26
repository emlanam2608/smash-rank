import { defineRouting } from 'next-intl/routing';

export const locales = ['en', 'vi'] as const;
export type AppLocale = (typeof locales)[number];

export const routing = defineRouting({
  locales,
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});
