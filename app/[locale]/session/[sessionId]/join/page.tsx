import { setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { SessionJoin } from "@/components/SessionJoin";

export async function generateMetadata({
  params,
}: {
  params: { locale: string; sessionId: string };
}): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://smashrank.app";
  const imageUrl = `${baseUrl}/api/og/session/${params.sessionId}`;
  const joinUrl = `${baseUrl}/session/${params.sessionId}/join`;
  const title = "Join a SmashRank Court Session";
  const description = "Scan the QR code or open this link to join a SmashRank badminton court session.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: joinUrl,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: "Scan to join this SmashRank court session" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function SessionJoinPage({
  params,
}: {
  params: { locale: string; sessionId: string };
}) {
  setRequestLocale(params.locale);
  return <SessionJoin sessionId={params.sessionId} />;
}
