import { setRequestLocale } from "next-intl/server";
import { SessionJoin } from "@/components/SessionJoin";

export default function SessionJoinPage({
  params,
}: {
  params: { locale: string; sessionId: string };
}) {
  setRequestLocale(params.locale);
  return <SessionJoin sessionId={params.sessionId} />;
}
