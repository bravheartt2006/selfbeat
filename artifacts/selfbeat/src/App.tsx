import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/react";
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
import SignUpPage from "@/pages/sign-up";
import PricingPage from "@/pages/pricing";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { LanguageProvider, useLanguage } from "@/lib/language-context";
import { CreditsProvider } from "@/lib/credits-context";

const queryClient = new QueryClient();

const CLERK_PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string;
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function Router() {
  const { hasChosen } = useLanguage();

  return (
    <div className="flex flex-col min-h-[100dvh]">
      {!hasChosen ? (
        <LanguageSelect />
      ) : (
        <>
          <Navbar />
          <main className="flex-1">
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/stream" component={StreamingResults} />
              <Route path="/results/:id" component={Results} />
              <Route path="/leaderboard" component={Leaderboard} />
              <Route path="/about" component={About} />
              <Route path="/pricing" component={PricingPage} />
              <Route path="/sign-in" component={SignInPage} />
              <Route path="/sign-in/sso-callback" component={SignInPage} />
              <Route path="/sign-up" component={SignUpPage} />
              <Route path="/sign-up/sso-callback" component={SignUpPage} />
              <Route component={NotFound} />
            </Switch>
          </main>
          <Footer />
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <ClerkProvider
      publishableKey={CLERK_PUBLISHABLE_KEY}
      signInUrl={`${BASE}/sign-in`}
      signUpUrl={`${BASE}/sign-up`}
      signInFallbackRedirectUrl={`${BASE}/`}
      signUpFallbackRedirectUrl={`${BASE}/`}
      clerkJSVariant="headless"
      proxyUrl="/api/__clerk"
    >
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
    </ClerkProvider>
  );
}

export default App;
