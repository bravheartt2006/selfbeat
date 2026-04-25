import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useAppAuth } from "@/lib/auth-context";
import { useToast } from "@/hooks/use-toast";

type CreditsState = {
  credits: number;
  isUnlimited: boolean;
  isLoaded: boolean;
  // Trial
  trialUsed: boolean;
  isOnActiveTrial: boolean;
  trialEndDate: string | null;
  trialExpiredRecently: boolean;
  startTrial: () => Promise<boolean>;
  refresh: () => Promise<void>;
  deductCredit: () => void;
};

const CreditsContext = createContext<CreditsState>({
  credits: 0,
  isUnlimited: false,
  isLoaded: false,
  trialUsed: false,
  isOnActiveTrial: false,
  trialEndDate: null,
  trialExpiredRecently: false,
  startTrial: async () => false,
  refresh: async () => {},
  deductCredit: () => {},
});

export function CreditsProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, user, isLoaded: authLoaded, refetchUser } = useAppAuth();
  const { toast } = useToast();
  const [credits, setCredits] = useState(0);
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [fingerprintId, setFingerprintId] = useState<string | null>(null);

  // Trial state
  const [trialUsed, setTrialUsed] = useState(false);
  const [isOnActiveTrial, setIsOnActiveTrial] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState<string | null>(null);
  const [trialExpiredRecently, setTrialExpiredRecently] = useState(false);

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

  const applyTrialData = useCallback((data: {
    isOnActiveTrial?: boolean;
    trialEndDate?: string | null;
    trialExpiredRecently?: boolean;
    trialUsed?: boolean;
  }) => {
    if (data.isOnActiveTrial !== undefined) setIsOnActiveTrial(data.isOnActiveTrial);
    if (data.trialEndDate !== undefined) setTrialEndDate(data.trialEndDate ?? null);
    if (data.trialExpiredRecently !== undefined) setTrialExpiredRecently(data.trialExpiredRecently);
    if (data.trialUsed !== undefined) setTrialUsed(!!data.trialUsed);
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
        const data = await res.json() as {
          credits: number;
          isUnlimited: boolean;
          isOnActiveTrial?: boolean;
          trialEndDate?: string | null;
          trialExpiredRecently?: boolean;
        };
        setCredits(data.credits);
        setIsUnlimited(data.isUnlimited);
        applyTrialData(data);
      }
    } catch {
      // silently ignore
    } finally {
      setIsLoaded(true);
    }
  }, [isSignedIn, applyTrialData]);

  // Sync from auth user object on initial load
  useEffect(() => {
    if (!authLoaded) return;
    if (!isSignedIn || !user) {
      setCredits(0);
      setIsUnlimited(false);
      setTrialUsed(false);
      setIsOnActiveTrial(false);
      setTrialEndDate(null);
      setTrialExpiredRecently(false);
      setIsLoaded(true);
      return;
    }
    setCredits(user.credits);
    setIsUnlimited(user.isUnlimited);
    applyTrialData({
      isOnActiveTrial: user.isOnActiveTrial,
      trialEndDate: user.trialEndDate,
      trialExpiredRecently: user.trialExpiredRecently,
      trialUsed: user.trialUsed,
    });
    setIsLoaded(true);
  }, [authLoaded, isSignedIn, user, applyTrialData]);

  // After sign-in: register fingerprint, get fresh user state
  useEffect(() => {
    if (!isSignedIn || !user?.id || !fingerprintId) return;

    fetch("/api/users/me", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fingerprint: fingerprintId }),
    })
      .then((r) => r.json())
      .then((data: {
        credits: number;
        isUnlimited: boolean;
        deviceCreditBlocked?: boolean;
        isOnActiveTrial?: boolean;
        trialEndDate?: string | null;
        trialExpiredRecently?: boolean;
        trialUsed?: boolean;
      }) => {
        setCredits(data.credits);
        setIsUnlimited(data.isUnlimited);
        applyTrialData(data);
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
  }, [isSignedIn, user?.id, fingerprintId, refresh, applyTrialData, toast]);

  const startTrial = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/trial/start", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) return false;
      const data = await res.json() as { trialEndDate: string };
      setIsOnActiveTrial(true);
      setTrialUsed(true);
      setTrialEndDate(data.trialEndDate);
      setTrialExpiredRecently(false);
      // Refetch user to sync full state
      refetchUser().catch(() => {});
      return true;
    } catch {
      return false;
    }
  }, [refetchUser]);

  const deductCredit = useCallback(() => {
    setCredits((c) => Math.max(0, c - 1));
  }, []);

  return (
    <CreditsContext.Provider value={{
      credits,
      isUnlimited,
      isLoaded,
      trialUsed,
      isOnActiveTrial,
      trialEndDate,
      trialExpiredRecently,
      startTrial,
      refresh,
      deductCredit,
    }}>
      {children}
    </CreditsContext.Provider>
  );
}

export function useCredits() {
  return useContext(CreditsContext);
}
