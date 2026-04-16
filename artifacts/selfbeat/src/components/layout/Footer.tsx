import { SelfbeatLogo } from "@/components/SelfbeatLogo";
import { Link } from "wouter";
import { useLanguage } from "@/lib/language-context";

export default function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="border-t border-border/40 py-12 mt-20 bg-background">
      <div className="container flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <SelfbeatLogo size={20} className="text-muted-foreground" />
          <span className="font-serif font-semibold text-muted-foreground">Selfbeat</span>
        </div>
        <p className="text-sm text-muted-foreground">{t("footerTagline")}</p>
        <div className="flex gap-4">
          <Link href="/about" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            {t("footerAbout")}
          </Link>
          <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            {t("footerTerms")}
          </a>
          <a href="#" className="text-sm text-muted-foreground hover:text-primary transition-colors">
            {t("footerPrivacy")}
          </a>
        </div>
      </div>
    </footer>
  );
}
