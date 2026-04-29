import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";

export type AppUser = {
  id: string;
  email: string | null;
  displayName: string | null;
  pictureUrl: string | null;
  credits: number;
  isUnlimited: boolean;
  hasUnlimited: boolean;
  unlimitedUntil: string | null;
  createdAt: string;
  referralCode: string | null;
  // Trial
  trialUsed: boolean;
  isOnActiveTrial: boolean;
  trialEndDate: string | null;
  trialExpiredRecently: boolean;
  // Admin
  isAdmin: boolean;
  // Subscription
  planType: "monthly" | "annual" | "team" | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

type AuthState = {
  user: AppUser | null;
  isSignedIn: boolean;
  isLoaded: boolean;
  refetchUser: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  isSignedIn: false,
  isLoaded: false,
  refetchUser: async () => {},
  signOut: async () => {},
});

const REF_KEY = "selfbeat_pending_ref";

export function captureReferralCode(code: string) {
  try { localStorage.setItem(REF_KEY, code); } catch {}
}

async function claimStoredReferral(): Promise<{ bonusCredits: number } | null> {
  try {
    const code = localStorage.getItem(REF_KEY);
    if (!code) return null;
    const res = await fetch("/api/referral/claim", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    localStorage.removeItem(REF_KEY);
    if (res.ok) {
      const d = await res.json();
      if (d.success && !d.alreadyClaimed && d.bonusCredits) {
        return { bonusCredits: d.bonusCredits };
      }
    }
  } catch {}
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [referralBonus, setReferralBonus] = useState<number | null>(null);
  const hasFetched = useRef(false);

  const refetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.ok) {
        const data = await res.json() as AppUser & { isUnlimited: boolean };
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    refetchUser();
  }, [refetchUser]);

  // Listen for the popup success message
  useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (e.data?.type === "selfbeat-auth-success") {
        // Claim any pending referral code first
        const bonus = await claimStoredReferral();
        if (bonus) setReferralBonus(bonus.bonusCredits);
        await refetchUser();
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [refetchUser]);

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } catch {}
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isSignedIn: !!user,
        isLoaded,
        refetchUser,
        signOut,
      }}
    >
      {children}
      {referralBonus !== null && (
        <ReferralWelcomeBanner
          bonusCredits={referralBonus}
          onDismiss={() => setReferralBonus(null)}
        />
      )}
    </AuthContext.Provider>
  );
}

function ReferralWelcomeBanner({ bonusCredits, onDismiss }: { bonusCredits: number; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 7000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-gradient-to-r from-amber-900/90 to-yellow-900/80 backdrop-blur border border-amber-500/40 rounded-2xl px-6 py-4 shadow-2xl text-center max-w-sm">
        <div className="text-2xl mb-1">🎉</div>
        <p className="text-sm font-bold text-amber-200">Welcome! You got {bonusCredits} bonus credits</p>
        <p className="text-xs text-amber-300/80 mt-0.5">Thanks to a friend's referral — you have {25 + bonusCredits} credits to start!</p>
        <button onClick={onDismiss} className="mt-2 text-xs text-amber-400/60 hover:text-amber-400 transition-colors">Dismiss</button>
      </div>
    </div>
  );
}

export function useAppAuth() {
  return useContext(AuthContext);
}
