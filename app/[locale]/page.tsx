import { setRequestLocale } from "next-intl/server";
import { HomeTabs } from "@/components/HomeTabs";
import type { AppLocale } from "@/i18n/routing";

type PageProps = {
  params: { locale: string };
};

export default function HomePage({ params }: PageProps) {
  const locale = params.locale as AppLocale;
  setRequestLocale(locale);
  return <HomeTabs />;
}
