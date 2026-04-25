import { useState, useEffect } from "react";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppAuth } from "@/lib/auth-context";

interface DebugInfo {
  loggedInEmail: string;
  adminEmailConfigured: string;
  match: boolean;
  verdict: string;
  note: string;
  passportUserEmail: string;
  sessionUserId: string;
}

export default function AdminDebugPage() {
  const { user, isLoaded, isSignedIn } = useAppAuth();
  const [info, setInfo] = useState<DebugInfo | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchDebug = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/debug", { credentials: "include" });
      if (res.status === 401) {
        setError("Not signed in — please sign in first.");
      } else if (res.ok) {
        setInfo(await res.json());
      } else {
        setError(`Server error: ${res.status}`);
      }
    } catch (e) {
      setError("Failed to reach the API.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && isSignedIn) fetchDebug();
    if (isLoaded && !isSignedIn) setError("You are not signed in.");
  }, [isLoaded, isSignedIn]);

  return (
    <div className="container max-w-2xl py-16 space-y-6">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-400" />
        <h1 className="text-xl font-serif font-bold">Admin Access Debug</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        This page helps diagnose why /admin access is being granted or denied.
      </p>

      {/* Current auth state from frontend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Frontend Auth State</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="isLoaded" value={String(isLoaded)} />
          <Row label="isSignedIn" value={String(isSignedIn)} />
          <Row label="user.email" value={user?.email ?? "(null)"} />
          <Row label="user.id" value={user?.id ?? "(null)"} mono />
        </CardContent>
      </Card>

      {/* Backend debug response */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Backend Check Result</CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchDebug}
            disabled={loading}
            className="h-7 gap-1 text-xs"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}
          {info && (
            <>
              <Row label="Logged-in email (resolved)" value={info.loggedInEmail} mono />
              <Row label="ADMIN_EMAIL env var" value={info.adminEmailConfigured} mono />
              <Row label="Passport req.user.email" value={info.passportUserEmail} mono />
              <Row label="Session userId" value={info.sessionUserId} mono />
              <Row label="Emails match?" value={String(info.match)} highlight={info.match ? "green" : "red"} />
              <div className={`mt-3 rounded-lg px-4 py-3 text-sm font-medium border ${
                info.match
                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                  : "bg-destructive/10 border-destructive/30 text-destructive"
              }`}>
                {info.verdict}
              </div>
              <p className="text-xs text-muted-foreground pt-1">{info.note}</p>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Remove or restrict access to this page once debugging is complete.
      </p>
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
  highlight,
}: {
  label: string;
  value: string;
  mono?: boolean;
  highlight?: "green" | "red";
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/20 pb-1.5">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span
        className={`text-right break-all ${mono ? "font-mono text-xs" : ""} ${
          highlight === "green"
            ? "text-green-400 font-semibold"
            : highlight === "red"
              ? "text-destructive font-semibold"
              : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}
