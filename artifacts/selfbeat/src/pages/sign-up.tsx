import { useEffect } from "react";
import { useLocation } from "wouter";

// Sign-up is unified with sign-in (Google OAuth flow handles both)
export default function SignUpPage() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation("/sign-in");
  }, [setLocation]);
  return null;
}
