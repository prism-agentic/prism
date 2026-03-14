/*
 * PRISM Footer — Neural Constellation Design
 */
import { Github } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

export default function Footer() {
  const { t } = useI18n();

  return (
    <footer className="border-t border-border/50 py-12">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo + tagline */}
          <div className="flex items-center gap-3">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663287025002/9FCABgkh4qp24hSM32ug7S/prism-logo_2f15d31f.png"
              alt="PRISM Logo"
              className="w-7 h-7 rounded-md object-cover"
            />
            <span className="font-display font-bold text-foreground">PRISM</span>
            <span className="text-muted-foreground text-sm font-mono">v0.2.0</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6 text-sm font-mono text-muted-foreground">
            <a
              href="https://github.com/prism-agentic/prism"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-prism-cyan transition-colors flex items-center gap-1.5"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
            <a
              href="/docs"
              className="hover:text-prism-cyan transition-colors"
            >
              {t("footer.docs")}
            </a>
            <a
              href="https://github.com/prism-agentic/prism/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-prism-cyan transition-colors"
            >
              {t("footer.issues")}
            </a>
          </div>

          {/* Copyright */}
          <div className="text-xs text-muted-foreground font-mono">
            {t("footer.license")}
          </div>
        </div>
      </div>
    </footer>
  );
}
