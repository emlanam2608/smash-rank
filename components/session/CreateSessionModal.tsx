"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query } from "firebase/firestore";
import { Copy, Image as ImageIcon, LoaderCircle, QrCode, Share2, Users } from "lucide-react";
import QRCode from "qrcode";
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
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imageCopied, setImageCopied] = useState(false);
  const [imageCopying, setImageCopying] = useState(false);

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

  async function copyJoinLink() {
    if (!joinUrl) return;
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  async function shareJoinLink() {
    if (!joinUrl) return;
    if (navigator.share) await navigator.share({ title: session?.title ?? "SmashRank session", text: t("shareText"), url: joinUrl });
    else await copyJoinLink();
  }

  async function copyQrImage() {
    if (!joinUrl || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") return;
    setImageCopying(true);
    try {
      const dataUrl = await QRCode.toDataURL(joinUrl, { errorCorrectionLevel: "H", margin: 3, width: 520 });
      const image = await fetch(dataUrl);
      const blob = await image.blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setImageCopied(true);
      window.setTimeout(() => setImageCopied(false), 1500);
    } finally {
      setImageCopying(false);
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
              <Button type="submit" className="w-full" disabled={busy || !title.trim()}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{busy ? t("creating") : t("create")}</Button>
            </form>
          ) : session ? (
            <div className="mt-4 space-y-4">
              {joinUrl ? <button type="button" onClick={() => setQrOpen(true)} className="mx-auto block rounded-3xl bg-white p-3 shadow-float transition-transform hover:scale-[1.02] active:scale-95"><QRCodeSVG value={joinUrl} size={192} level="M" includeMargin /></button> : null}
              <p className="text-center text-xs text-slate-400">{t("scanHint")}</p>
              <p className="text-center text-sm font-semibold text-emerald-400">{t("codeDisplay", { code: session.code })}</p>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Users className="h-4 w-4 text-emerald-400" />{t("checkedIn", { count: session.playerIds.length })}</p>
                <div className="flex -space-x-2 overflow-hidden py-1">
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
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="items-center text-center">
          <DialogTitle>{t("shareTitle")}</DialogTitle>
          <DialogDescription>{t("shareDescription")}</DialogDescription>
          {joinUrl ? <div className="mt-5 rounded-[2rem] bg-white p-5 shadow-float"><QRCodeSVG value={joinUrl} size={260} level="H" includeMargin /></div> : null}
          <div className="mt-5 grid w-full grid-cols-3 gap-3">
            <Button type="button" variant="outline" onClick={() => copyJoinLink()}><Copy className="h-4 w-4" />{copied ? t("copied") : t("copyLink")}</Button>
            <Button type="button" variant="outline" disabled={imageCopying} onClick={() => copyQrImage()}>{imageCopying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}{imageCopied ? t("imageCopied") : t("copyImage")}</Button>
            <Button type="button" onClick={() => shareJoinLink()}><Share2 className="h-4 w-4" />{t("sharePreview")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AttendeeAvatar({ name, photoURL }: { name: string; photoURL?: string }) {
  const avatar = photoURL ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={photoURL} alt={name} title={name} className="h-10 w-10 rounded-full object-cover ring-2 ring-slate-950" />
  ) : <div title={name} className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-emerald-300 ring-2 ring-slate-950">{name.slice(0, 1).toUpperCase()}</div>;
  return <div className="relative shrink-0">{avatar}<span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-400" /></div>;
}
