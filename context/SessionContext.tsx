"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

const STORAGE_KEY = "smashrank.activeSessionId";

type SessionContextValue = {
  activeSessionId: string | null;
  setActiveSessionId: (sessionId: string | null) => void;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(null);

  useEffect(() => {
    setActiveSessionIdState(window.localStorage.getItem(STORAGE_KEY));
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      activeSessionId,
      setActiveSessionId: (sessionId) => {
        setActiveSessionIdState(sessionId);
        if (sessionId) window.localStorage.setItem(STORAGE_KEY, sessionId);
        else window.localStorage.removeItem(STORAGE_KEY);
      },
    }),
    [activeSessionId],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within SessionProvider");
  return context;
}
