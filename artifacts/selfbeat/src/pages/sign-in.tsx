import { useState } from "react";
import { useSignIn, useAuth } from "@clerk/react";
import { useLocation } from "wouter";
import { SelfbeatLogo } from "@/components/SelfbeatLogo";
import { useLanguage } from "@/lib/language-context";

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 0 1-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35Z" fill="#4285F4"/>
      <path d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.759-5.596-4.123H1.064v2.59A9.996 9.996 0 0 0 10 20Z" fill="#34A853"/>
      <path d="M4.404 11.9A6.01 6.01 0 0 1 4.09 10c0-.664.114-1.309.314-1.9V5.51H1.064A9.996 9.996 0 0 0 0 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59Z" fill="#FBBC05"/>
      <path d="M10 3.977c1.468 0 2.786.505 3.822 1.496l2.868-2.868C14.959.99 12.695 0 10 0A9.996 9.996 0 0 0 1.064 5.51l3.34 2.59C5.19 5.736 7.395 3.977 10 3.977Z" fill="#EA4335"/>
    </svg>
  );
}

export default function SignInPage() {
  const { signIn, isLoaded } = useSignIn();
  const { isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  if (isSignedIn) {
    setLocation("/");
    return null;
  }

  const handleGoogleSignIn = async () => {
    if (!isLoaded || loading) return;
    setLoading(true);
    setError(null);
    try {
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${base}/sign-in/sso-callback`,
        redirectUrlComplete: `${base}/`,
      });
    } catch (err: any) {
      setError(err?.errors?.[0]?.longMessage ?? "Sign in failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-120px)] px-4 py-12">
      <div className="w-full max-w-sm">

        {/* Logo + heading */}
        <div className="flex flex-col items-center mb-10">
          <SelfbeatLogo size={56} className="text-primary mb-4" />
          <h1 className="text-2xl font-bold font-serif text-foreground">
            {t("sign_in_to_selfbeat") ?? "Sign in to Selfbeat"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            {t("sign_in_subtitle") ?? "Watch 11 AI models answer, self-critique, and receive a verdict."}
          </p>
        </div>

        {/* Free credits callout */}
        <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 px-5 py-4 text-center">
          <p className="text-sm font-semibold text-foreground">10 free comparisons on sign-up</p>
          <p className="text-xs text-muted-foreground mt-0.5">No credit card required</p>
        </div>

        {/* Google button */}
        <button
          onClick={handleGoogleSignIn}
          disabled={!isLoaded || loading}
          className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl border border-border bg-card hover:bg-accent transition-all text-sm font-medium text-foreground shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="h-5 w-5 rounded-full border-2 border-muted-foreground border-t-primary animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          {loading ? "Redirecting to Google..." : "Continue with Google"}
        </button>

        {error && (
          <p className="mt-3 text-xs text-destructive text-center">{error}</p>
        )}

        <p className="mt-8 text-center text-xs text-muted-foreground leading-relaxed">
          By signing in you agree to our{" "}
          <a href="/about" className="underline hover:text-foreground transition-colors">Terms of Service</a>
          {" "}and{" "}
          <a href="/about" className="underline hover:text-foreground transition-colors">Privacy Policy</a>.
        </p>
      </div>
    </div>
  );
}
