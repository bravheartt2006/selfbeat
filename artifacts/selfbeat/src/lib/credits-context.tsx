import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useAppAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

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
  const { isSignedIn, user, isLoaded: authLoaded } = useAppAuth();
  const { toast } = useToast();
  const [credits, setCredits] = useState(0);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [fingerprintId, setFingerprintId] = useState<string | null>(null);

  // Load fingerprint once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getFingerprint } = await import("@/lib/fingerprint");
        const id = await getFingerprint();
        if (!cancelled) setFingerprintId(id);
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
      const res = await fetch("/api/users/me/credits", { credentials: "include" });
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

  // Sync credits from auth user object on initial load
  useEffect(() => {
    if (!authLoaded) return;
    if (!isSignedIn || !user) {
      setCredits(0);
      setIsUnlimited(false);
      setIsLoaded(true);
      return;
    }
    // Seed from user object immediately (avoids flicker)
    setCredits(user.credits);
    setIsUnlimited(user.isUnlimited);
    setIsLoaded(true);
  }, [authLoaded, isSignedIn, user]);

  // After sign-in, register fingerprint for anti-fraud check
  useEffect(() => {
    if (!isSignedIn || !user?.id || !fingerprintId) return;

    fetch("/api/users/me", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint: fingerprintId }),
    })
      .then((r) => r.json())
      .then((data: { credits: number; isUnlimited: boolean; deviceCreditBlocked?: boolean }) => {
        setCredits(data.credits);
        setIsUnlimited(data.isUnlimited);
        if (data.deviceCreditBlocked) {
          toast({
            title: "Free credits already used on this device",
            description: "Subscribe to continue using Selfbeat.",
            variant: "destructive",
            duration: 8000,
          });
        }
      })
      .catch(() => { refresh(); });
  }, [isSignedIn, user?.id, fingerprintId, refresh]);

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
