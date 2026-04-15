import { Switch, Route, Router as WouterRouter } from "wouter";
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
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { LanguageProvider, useLanguage } from "@/lib/language-context";

const queryClient = new QueryClient();

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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LanguageProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </LanguageProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
