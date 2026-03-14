/*
 * PRISM Navbar — Neural Constellation Design
 * Floating glass navigation with cyan accent highlights + language toggle
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Github, BookOpen, Globe } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

const NAV_KEYS = [
  { key: "nav.features", href: "#features" },
  { key: "nav.architecture", href: "#architecture" },
  { key: "nav.pipeline", href: "#pipeline" },
  { key: "nav.evolution", href: "#evolution" },
  { key: "nav.quickstart", href: "#quickstart" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t, locale, toggleLocale } = useI18n();

  const scrollTo = (href: string) => {
    setMobileOpen(false);
    const el = document.querySelector(href);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-4">
        <div className="glass-card rounded-xl px-6 py-3 flex items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-3 group">
            <img
              src="https://d2xsxph8kpxj0f.cloudfront.net/310519663287025002/9FCABgkh4qp24hSM32ug7S/prism-logo_2f15d31f.png"
              alt="PRISM Logo"
              className="w-8 h-8 rounded-lg object-cover"
            />
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              PRISM
            </span>
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_KEYS.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-prism-cyan transition-colors font-mono"
              >
                {t(link.key)}
              </button>
            ))}
          </div>

          {/* CTA + Language + GitHub */}
          <div className="hidden md:flex items-center gap-3">
            {/* Language toggle */}
            <button
              onClick={toggleLocale}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-mono border border-border/50 rounded-lg hover:border-prism-cyan/30"
            >
              <Globe className="w-3.5 h-3.5" />
              {locale === "zh" ? "EN" : "中文"}
            </button>
            <a
              href="https://github.com/prism-agentic/prism"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
            <a
              href="/docs"
              className="px-4 py-2 text-sm font-medium bg-prism-cyan/10 text-prism-cyan border border-prism-cyan/30 rounded-lg hover:bg-prism-cyan/20 transition-all"
            >
              <BookOpen className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
              {t("nav.docs")}
            </a>
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-muted-foreground"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="md:hidden glass-card rounded-xl mt-2 p-4"
            >
              {NAV_KEYS.map((link) => (
                <button
                  key={link.href}
                  onClick={() => scrollTo(link.href)}
                  className="block w-full text-left px-3 py-2.5 text-sm text-muted-foreground hover:text-prism-cyan transition-colors font-mono"
                >
                  {t(link.key)}
                </button>
              ))}
              <div className="border-t border-border mt-2 pt-3 flex items-center gap-3">
                <button
                  onClick={toggleLocale}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-mono border border-border/50 rounded-lg"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {locale === "zh" ? "EN" : "中文"}
                </button>
                <a
                  href="https://github.com/prism-agentic/prism"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Github className="w-5 h-5" />
                </a>
                <a
                  href="/docs"
                  className="px-4 py-2 text-sm font-medium bg-prism-cyan/10 text-prism-cyan border border-prism-cyan/30 rounded-lg"
                >
                  {t("nav.docs")}
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
