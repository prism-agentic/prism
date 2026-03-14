/*
 * PRISM Navbar — Neural Constellation Design
 * Floating glass navigation with cyan accent highlights
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Github, BookOpen, Terminal } from "lucide-react";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Architecture", href: "#architecture" },
  { label: "Pipeline", href: "#pipeline" },
  { label: "Evolution", href: "#evolution" },
  { label: "Quick Start", href: "#quickstart" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

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
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-prism-cyan to-prism-amber flex items-center justify-center">
              <Terminal className="w-4 h-4 text-prism-navy" strokeWidth={2.5} />
            </div>
            <span className="font-display text-lg font-bold tracking-tight text-foreground">
              PRISM
            </span>
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <button
                key={link.href}
                onClick={() => scrollTo(link.href)}
                className="px-3 py-1.5 text-sm text-muted-foreground hover:text-prism-cyan transition-colors font-mono"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* CTA + GitHub */}
          <div className="hidden md:flex items-center gap-3">
            <a
              href="https://github.com/prism-agentic/prism"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-5 h-5" />
            </a>
            <a
              href="https://github.com/prism-agentic/prism#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-sm font-medium bg-prism-cyan/10 text-prism-cyan border border-prism-cyan/30 rounded-lg hover:bg-prism-cyan/20 transition-all"
            >
              <BookOpen className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
              Docs
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
              {NAV_LINKS.map((link) => (
                <button
                  key={link.href}
                  onClick={() => scrollTo(link.href)}
                  className="block w-full text-left px-3 py-2.5 text-sm text-muted-foreground hover:text-prism-cyan transition-colors font-mono"
                >
                  {link.label}
                </button>
              ))}
              <div className="border-t border-border mt-2 pt-3 flex items-center gap-3">
                <a
                  href="https://github.com/prism-agentic/prism"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Github className="w-5 h-5" />
                </a>
                <a
                  href="https://github.com/prism-agentic/prism#readme"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 text-sm font-medium bg-prism-cyan/10 text-prism-cyan border border-prism-cyan/30 rounded-lg"
                >
                  Docs
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </nav>
  );
}
