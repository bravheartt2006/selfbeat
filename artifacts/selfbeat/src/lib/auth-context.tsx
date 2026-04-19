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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
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
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "selfbeat-auth-success") {
        refetchUser();
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
    </AuthContext.Provider>
  );
}

export function useAppAuth() {
  return useContext(AuthContext);
}
