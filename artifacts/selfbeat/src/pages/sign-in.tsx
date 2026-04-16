import { SignIn } from "@clerk/react";
import { useLanguage } from "@/lib/language-context";

export default function SignInPage() {
  const { t } = useLanguage();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-120px)] px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-foreground">
          {t("sign_in_to_selfbeat") ?? "Sign in to Selfbeat"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("sign_in_subtitle") ?? "Watch 11 AI models answer, self-critique, and receive a verdict."}
        </p>
      </div>
      <SignIn
        routing="path"
        path={`${base}/sign-in`}
        signUpUrl={`${base}/sign-up`}
        fallbackRedirectUrl={`${base}/`}
      />
    </div>
  );
}
