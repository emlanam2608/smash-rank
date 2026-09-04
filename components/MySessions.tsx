"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, onSnapshot, query, where, type DocumentData, type QuerySnapshot } from "firebase/firestore";
import { CalendarDays, LogIn, Radio, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { LoadingIndicator } from "@/components/ui/loading-indicator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/context/SessionContext";
import { db } from "@/lib/firebase";
import { SESSIONS_COLLECTION, sessionFromSnapshot } from "@/lib/firebase/sessions";
import type { Session } from "@/lib/types";

type SessionGroups = {
  hosted: Session[];
  joined: Session[];
};

export function MySessions() {
  const t = useTranslations("mySessions");
  const locale = useLocale();
  const { user, loading, configured, signIn } = useAuth();
  const { activeSessionId, setActiveSessionId } = useSession();
  const [sessions, setSessions] = useState<SessionGroups>({ hosted: [], joined: [] });
  const [loaded, setLoaded] = useState({ hosted: false, joined: false });

  useEffect(() => {
    if (!db || !user) {
      setSessions({ hosted: [], joined: [] });
      setLoaded({ hosted: false, joined: false });
      return;
    }

    const toSessions = (snapshot: QuerySnapshot<DocumentData>) =>
      snapshot.docs.map((item) => sessionFromSnapshot(item.id, item.data() as Record<string, unknown>));

    const unsubscribeHosted = onSnapshot(
      query(collection(db, SESSIONS_COLLECTION), where("hostId", "==", user.uid)),
      (snapshot) => {
        setSessions((current) => ({ ...current, hosted: toSessions(snapshot) }));
        setLoaded((current) => ({ ...current, hosted: true }));
      },
    );
    const unsubscribeJoined = onSnapshot(
      query(collection(db, SESSIONS_COLLECTION), where("playerIds", "array-contains", user.uid)),
      (snapshot) => {
        setSessions((current) => ({ ...current, joined: toSessions(snapshot) }));
        setLoaded((current) => ({ ...current, joined: true }));
      },
    );

    return () => {
      unsubscribeHosted();
      unsubscribeJoined();
    };
  }, [user]);

  const sortedSessions = useMemo(() => ({
    hosted: sortSessions(sessions.hosted),
    joined: sortSessions(sessions.joined.filter((session) => session.hostId !== user?.uid)),
  }), [sessions, user?.uid]);

  if (!configured) return null;

  if (loading) {
    return <LoadingIndicator className="py-10" label={t("loading")} />;
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("signInPrompt")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" className="w-full" onClick={() => signIn()}>
            <LogIn className="h-4 w-4" />
            {t("signIn")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isLoading = !loaded.hosted || !loaded.joined;
  const hasSessions = sortedSessions.hosted.length > 0 || sortedSessions.joined.length > 0;

  return (
    <section aria-labelledby="my-sessions-title" className="space-y-5">
      <div>
        <h1 id="my-sessions-title" className="text-xl font-black tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-400">{t("subtitle")}</p>
      </div>

      {isLoading ? <LoadingIndicator className="py-8" label={t("loading")} /> : null}
      {!isLoading && !hasSessions ? <EmptyState label={t("empty")} /> : null}
      {!isLoading && sortedSessions.hosted.length > 0 ? (
        <SessionGroup icon={<Radio className="h-4 w-4" />} title={t("hostedTitle")} sessions={sortedSessions.hosted} locale={locale} activeSessionId={activeSessionId} onSelect={setActiveSessionId} />
      ) : null}
      {!isLoading && sortedSessions.joined.length > 0 ? (
        <SessionGroup icon={<Users className="h-4 w-4" />} title={t("joinedTitle")} sessions={sortedSessions.joined} locale={locale} activeSessionId={activeSessionId} onSelect={setActiveSessionId} />
      ) : null}
    </section>
  );
}

function SessionGroup({ icon, title, sessions, locale, activeSessionId, onSelect }: {
  icon: ReactNode;
  title: string;
  sessions: Session[];
  locale: string;
  activeSessionId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations("mySessions");
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-300">{icon}{title}</h2>
      <div className="space-y-3">
        {sessions.map((session) => (
          <Card key={session.id}>
            <CardHeader className="gap-2">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="min-w-0 truncate">{session.title}</CardTitle>
                <span className={session.status === "active" ? "rounded-full bg-emerald-400/15 px-2.5 py-1 text-xs font-bold text-emerald-300" : "rounded-full bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-400"}>
                  {session.status === "active" ? t("active") : t("closed")}
                </span>
              </div>
              <CardDescription className="flex flex-wrap gap-x-4 gap-y-1">
                <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{t("players", { count: session.playerIds.length })}</span>
                <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatSessionDate(session.createdAt, locale)}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button type="button" size="sm" className="flex-1" disabled={session.status !== "active" || activeSessionId === session.id} onClick={() => onSelect(session.id)}>
                {activeSessionId === session.id ? t("selected") : t("select")}
              </Button>
              <Button asChild variant="outline" size="sm">
                <a href={`/${locale}/session/${session.id}/join`}>{t("open")}</a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ label }: { label: string }) {
  return <Card><CardContent className="py-10 text-center text-sm text-slate-400">{label}</CardContent></Card>;
}

function sortSessions(sessions: Session[]) {
  return [...sessions].sort((first, second) => getTimestamp(second.createdAt) - getTimestamp(first.createdAt));
}

function getTimestamp(value: unknown) {
  return value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function"
    ? value.toMillis()
    : 0;
}

function formatSessionDate(value: unknown, locale: string) {
  const timestamp = getTimestamp(value);
  return timestamp
    ? new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(timestamp)
    : "—";
}
