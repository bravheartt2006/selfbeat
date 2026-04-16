import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useAuth, useUser } from "@clerk/react";

type CreditsState = {
  credits: number;
  isUnlimited: boolean;
  isLoaded: boolean;
  refresh: () => Promise<void>;
  deductCredit: () => void;
};

const CreditsContext = createContext<CreditsState>({
  credits: 0,
  isUnlimited: false,
  isLoaded: false,
  refresh: async () => {},
  deductCredit: () => {},
});

export function CreditsProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const [credits, setCredits] = useState(0);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [fingerprintId, setFingerprintId] = useState<string | null>(null);

  // Load fingerprint once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const FingerprintJS = await import("@fingerprintjs/fingerprintjs");
        const fp = await FingerprintJS.default.load();
        const result = await fp.get();
        if (!cancelled) setFingerprintId(result.visitorId);
      } catch {
        // silently ignore
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const refresh = useCallback(async () => {
    if (!isSignedIn) {
      setCredits(0);
      setIsUnlimited(false);
      setIsLoaded(true);
      return;
    }
    try {
      const res = await fetch("/api/users/me/credits");
      if (res.ok) {
        const data = await res.json() as { credits: number; isUnlimited: boolean };
        setCredits(data.credits);
        setIsUnlimited(data.isUnlimited);
      }
    } catch {
      // silently ignore
    } finally {
      setIsLoaded(true);
    }
  }, [isSignedIn]);

  // Register user on sign-in (gives 10 free credits on first sign-in)
  useEffect(() => {
    if (!isSignedIn || !userId) {
      setIsLoaded(true);
      return;
    }
    const email = user?.primaryEmailAddress?.emailAddress;
    fetch("/api/users/me", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, fingerprint: fingerprintId }),
    })
      .then((r) => r.json())
      .then((data: { credits: number; isUnlimited: boolean }) => {
        setCredits(data.credits);
        setIsUnlimited(data.isUnlimited);
        setIsLoaded(true);
      })
      .catch(() => {
        refresh();
      });
  }, [isSignedIn, userId, user, fingerprintId, refresh]);

  const deductCredit = useCallback(() => {
    setCredits((c) => Math.max(0, c - 1));
  }, []);

  return (
    <CreditsContext.Provider value={{ credits, isUnlimited, isLoaded, refresh, deductCredit }}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  return useContext(CreditsContext);
}

export function getFingerprint(): Promise<string> {
  return import("@fingerprintjs/fingerprintjs").then(async (FingerprintJS) => {
    const fp = await FingerprintJS.default.load();
    const result = await fp.get();
    return result.visitorId;
  });
}
