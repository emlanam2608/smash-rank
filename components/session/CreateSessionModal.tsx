"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { QrCode, Users } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSession } from "@/context/SessionContext";
import { db } from "@/lib/firebase";
import { createSession, getRealtimeSession } from "@/lib/firebase/sessions";
import { USERS_COLLECTION, userFromSnapshot } from "@/lib/matches";
import type { Session, User } from "@/lib/types";
import { SessionSummaryModal } from "@/components/session/SessionSummaryModal";

export function CreateSessionModal() {
  const t = useTranslations("session");
  const locale = useLocale();
  const { user, configured } = useAuth();
  const { setActiveSessionId } = useSession();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    return getRealtimeSession(sessionId, setSession);
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !db) return;
    return onSnapshot(query(collection(db, USERS_COLLECTION)), (snapshot) => {
      setUsers(snapshot.docs.map((item) => userFromSnapshot(item.id, item.data() as Record<string, unknown>)));
    });
  }, [sessionId]);

  const attendees = useMemo(
    () => users.filter((player) => session?.playerIds.includes(player.id)),
    [session?.playerIds, users],
  );
  const joinUrl = sessionId && typeof window !== "undefined"
    ? `${window.location.origin}/${locale}/session/${sessionId}/join`
    : "";

  if (!configured || !user) return null;

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const id = await createSession({ title, code: code || undefined });
      setSessionId(id);
      setActiveSessionId(id);
      setTitle("");
      setCode("");
    } catch (createError) {
      setError(
        createError instanceof Error && createError.message === "INVALID_SESSION_CODE"
          ? t("errors.code")
          : t("errors.create"),
      );
    } finally {
      setBusy(false);
    }
  }

  function resetDialog(openState: boolean) {
    setOpen(openState);
    if (!openState && session?.status === "closed") {
      setSessionId(null);
      setSession(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={resetDialog}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            <QrCode className="h-4 w-4" />
            <span className="hidden sm:inline">{t("create")}</span>
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>{session ? session.title : t("createTitle")}</DialogTitle>
          <DialogDescription>{session ? t("hostDescription") : t("createDescription")}</DialogDescription>
          {!sessionId ? (
            <form className="mt-4 space-y-3" onSubmit={handleCreate}>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("titlePlaceholder")} aria-label={t("titleLabel")} maxLength={80} autoFocus />
              <Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder={t("codePlaceholder")} aria-label={t("codeLabel")} inputMode="numeric" />
              <Button type="submit" className="w-full" disabled={busy || !title.trim()}>{busy ? t("creating") : t("create")}</Button>
            </form>
          ) : session ? (
            <div className="mt-4 space-y-4">
              {joinUrl ? <div className="mx-auto w-fit rounded-2xl bg-white p-3"><QRCodeSVG value={joinUrl} size={192} level="M" includeMargin /></div> : null}
              <p className="text-center text-xs text-slate-400">{t("scanHint")}</p>
              <p className="text-center text-sm font-semibold text-emerald-400">{t("codeDisplay", { code: session.code })}</p>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-emerald-400" />{t("checkedIn", { count: session.playerIds.length })}</p>
                <div className="grid grid-cols-5 gap-2">
                  {attendees.map((player) => <AttendeeAvatar key={player.id} name={player.displayName} photoURL={player.photoURL} />)}
                </div>
              </div>
              {session.status === "active" && session.hostId === user.uid ? (
                <Button type="button" variant="destructive" className="w-full" onClick={() => setSummaryOpen(true)}>{t("close")}</Button>
              ) : <p className="text-center text-sm text-slate-400">{t("closed")}</p>}
            </div>
          ) : <p className="mt-4 text-center text-sm text-slate-400">{t("loading")}</p>}
          {error ? <p className="mt-3 text-center text-sm text-rose-400">{error}</p> : null}
        </DialogContent>
      </Dialog>
      {session ? <SessionSummaryModal session={session} open={summaryOpen} onOpenChange={setSummaryOpen} /> : null}
    </>
  );
}

function AttendeeAvatar({ name, photoURL }: { name: string; photoURL?: string }) {
  return photoURL ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoURL} alt={name} title={name} className="h-10 w-10 rounded-full object-cover" />
  ) : <div title={name} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-emerald-300">{name.slice(0, 1).toUpperCase()}</div>;
}
