import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Results from "@/pages/results";
import StreamingResults from "@/pages/streaming-results";
import Leaderboard from "@/pages/leaderboard";
import About from "@/pages/about";
import LanguageSelect from "@/pages/language-select";
import SignInPage from "@/pages/sign-in";
import PricingPage from "@/pages/pricing";
import BlogPage from "@/pages/blog";
import BlogPostPage from "@/pages/blog-post";
import PrivacyPolicy from "@/pages/privacy";
import TermsOfService from "@/pages/terms";
import AdminQotd from "@/pages/admin-qotd";
import AdminPage from "@/pages/admin";
import AdminDebugPage from "@/pages/admin-debug";
import SettingsPage from "@/pages/settings";
import UnsubscribePage from "@/pages/unsubscribe";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import TrialBanner from "@/components/TrialBanner";
import { LanguageProvider, useLanguage } from "@/lib/language-context";
import { CreditsProvider } from "@/lib/credits-context";
import { AuthProvider, useAppAuth, captureReferralCode } from "@/lib/auth-context";

const queryClient = new QueryClient();
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// Capture ?ref= from URL on first load
(function captureRef() {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (ref && ref.startsWith("SELF-")) captureReferralCode(ref);
  } catch {}
})()

// Pages that require authentication
const PROTECTED_PATHS = ["/stream", "/results"];

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAppAuth();
  const [location, setLocation] = useLocation();

  const needsRedirect = isLoaded && !isSignedIn && PROTECTED_PATHS.some((p) => location.startsWith(p));

  useEffect(() => {
    if (needsRedirect) setLocation("/sign-in");
  }, [needsRedirect, setLocation]);

  if (!isLoaded || needsRedirect) return null;

  return <>{children}</>;
}

function Router() {
  const { hasChosen } = useLanguage();

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {!hasChosen ? (
        <LanguageSelect />
      ) : (
        <>
          <Navbar />
          <TrialBanner />
          <main className="flex-1">
            <RequireAuth>
              <Switch>
                <Route path="/" component={Home} />
                <Route path="/stream" component={StreamingResults} />
                <Route path="/results/:id" component={Results} />
                <Route path="/leaderboard" component={Leaderboard} />
                <Route path="/about" component={About} />
                <Route path="/pricing" component={PricingPage} />
                <Route path="/blog" component={BlogPage} />
                <Route path="/blog/:slug" component={BlogPostPage} />
                <Route path="/privacy" component={PrivacyPolicy} />
                <Route path="/terms" component={TermsOfService} />
                <Route path="/sign-in" component={SignInPage} />
                <Route path="/sign-up" component={SignInPage} />
                <Route path="/admin" component={AdminPage} />
                <Route path="/admin/debug" component={AdminDebugPage} />
                <Route path="/admin/qotd" component={AdminQotd} />
                <Route path="/settings" component={SettingsPage} />
                <Route path="/unsubscribe/:token" component={UnsubscribePage} />
                <Route component={NotFound} />
              </Switch>
            </RequireAuth>
          </main>
          <Footer />
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <CreditsProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <LanguageProvider>
              <WouterRouter base={BASE}>
                <Router />
              </WouterRouter>
            </LanguageProvider>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </CreditsProvider>
    </AuthProvider>
  );
}

export default App;
