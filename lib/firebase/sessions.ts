import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db, isFirebaseConfigured } from "@/lib/firebase";
import type { Session } from "@/lib/types";

export const SESSIONS_COLLECTION = "sessions";

function requireDatabase() {
  if (!isFirebaseConfigured() || !db || !auth?.currentUser) {
    throw new Error("UNAUTHENTICATED");
  }
  return { firestore: db, userId: auth.currentUser.uid };
}

function createCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export function sessionFromSnapshot(id: string, data: Record<string, unknown>): Session {
  return {
    id,
    hostId: typeof data.hostId === "string" ? data.hostId : "",
    title: typeof data.title === "string" ? data.title : "Session",
    code: typeof data.code === "string" ? data.code : "",
    createdAt: data.createdAt ?? null,
    closedAt: data.closedAt ?? null,
    status: data.status === "closed" ? "closed" : "active",
    playerIds: Array.isArray(data.playerIds)
      ? data.playerIds.filter((value): value is string => typeof value === "string")
      : [],
  };
}

export async function createSession(params: { title: string; code?: string }): Promise<string> {
  const { firestore, userId } = requireDatabase();
  const title = params.title.trim();
  const code = params.code?.trim() || createCode();
  if (!title) throw new Error("INVALID_SESSION_TITLE");
  if (!/^\d{4}$/.test(code)) throw new Error("INVALID_SESSION_CODE");

  const ref = await addDoc(collection(firestore, SESSIONS_COLLECTION), {
    hostId: userId,
    title,
    code,
    createdAt: serverTimestamp(),
    closedAt: null,
    status: "active",
    playerIds: [userId],
  });
  return ref.id;
}

export async function joinSessionByQR(sessionId: string): Promise<Session> {
  const { firestore, userId } = requireDatabase();
  const ref = doc(firestore, SESSIONS_COLLECTION, sessionId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("SESSION_NOT_FOUND");
  const session = sessionFromSnapshot(snapshot.id, snapshot.data() as Record<string, unknown>);
  if (session.status !== "active") throw new Error("SESSION_CLOSED");
  await updateDoc(ref, { playerIds: arrayUnion(userId) });
  return session;
}

export async function joinSessionByCode(code: string): Promise<Session> {
  const { firestore } = requireDatabase();
  const snapshot = await getDocs(
    query(collection(firestore, SESSIONS_COLLECTION), where("code", "==", code.trim())),
  );
  const sessionDoc = snapshot.docs
    .map((item) => sessionFromSnapshot(item.id, item.data() as Record<string, unknown>))
    .find((session) => session.status === "active");
  if (!sessionDoc) throw new Error("SESSION_NOT_FOUND");
  return joinSessionByQR(sessionDoc.id);
}

export async function closeSession(sessionId: string): Promise<void> {
  const { firestore, userId } = requireDatabase();
  const ref = doc(firestore, SESSIONS_COLLECTION, sessionId);
  const snapshot = await getDoc(ref);
  if (!snapshot.exists()) throw new Error("SESSION_NOT_FOUND");
  if (snapshot.data().hostId !== userId) throw new Error("FORBIDDEN");
  await updateDoc(ref, { status: "closed", closedAt: serverTimestamp() });
}

export function getRealtimeSession(
  sessionId: string,
  onChange: (session: Session | null) => void,
): Unsubscribe {
  if (!db) return () => undefined;
  return onSnapshot(doc(db, SESSIONS_COLLECTION, sessionId), (snapshot) => {
    onChange(
      snapshot.exists()
        ? sessionFromSnapshot(snapshot.id, snapshot.data() as Record<string, unknown>)
        : null,
    );
  });
}
