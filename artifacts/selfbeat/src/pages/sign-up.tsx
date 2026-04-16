import { SignUp } from "@clerk/react";
import { useLanguage } from "@/lib/language-context";

export default function SignUpPage() {
  const { t } = useLanguage();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-120px)] px-4 py-12">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-foreground">
          {t("create_account") ?? "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("signup_subtitle") ?? "Get 10 free comparisons. No credit card required."}
        </p>
      </div>
      <SignUp
        routing="path"
        path={`${base}/sign-up`}
        signInUrl={`${base}/sign-in`}
        fallbackRedirectUrl={`${base}/`}
      />
    </div>
  );
}
