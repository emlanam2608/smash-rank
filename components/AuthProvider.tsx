"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import { ensureUserProfile } from "@/lib/matches";

type AuthContextValue = {
  user: FirebaseUser | null;
  loading: boolean;
  configured: boolean;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();

  useEffect(() => {
    if (!configured || !auth) {
      setLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (next) => {
      setUser(next);
      if (next) {
        try {
          await ensureUserProfile({
            uid: next.uid,
            displayName: next.displayName,
            photoURL: next.photoURL,
          });
        } catch {
          // Profile sync should not block the session.
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [configured]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured,
      signIn: async () => {
        if (!configured || !auth) {
          throw new Error("FIREBASE_UNAVAILABLE");
        }
        await signInWithPopup(auth, googleProvider);
      },
      signOutUser: async () => {
        if (!configured || !auth) {
          return;
        }
        await signOut(auth);
      },
    }),
    [user, loading, configured],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
