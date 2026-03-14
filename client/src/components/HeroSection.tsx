/*
 * PRISM Hero Section — Neural Constellation Design
 * Full-bleed hero with constellation background, asymmetric layout
 * Text left, animated visual right
 */
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, GitBranch } from "lucide-react";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663287025002/9FCABgkh4qp24hSM32ug7S/prism-hero-bg-ZapLqSCNvV2QuQ9Qbb2Wsk.webp";

export default function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${HERO_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-r from-[#0a0e1a]/95 via-[#0a0e1a]/70 to-[#0a0e1a]/40" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#0a0e1a] via-transparent to-[#0a0e1a]/50" />

      <div className="relative z-10 container mx-auto pt-32 pb-20">
        <div className="grid lg:grid-cols-5 gap-12 items-center">
          {/* Left content — 3 cols */}
          <motion.div
            className="lg:col-span-3 space-y-8"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-prism-cyan/30 bg-prism-cyan/5 text-prism-cyan text-sm font-mono"
            >
              <Sparkles className="w-3.5 h-3.5" />
              v0.2.0 — Open Source
            </motion.div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display font-bold leading-[1.1] tracking-tight">
              <span className="text-foreground">Agents That</span>
              <br />
              <span className="text-gradient-cyan">Learn</span>
              <span className="text-foreground">, </span>
              <span className="text-gradient-amber">Evolve</span>
              <span className="text-foreground">,</span>
              <br />
              <span className="text-foreground">& Ship</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed">
              PRISM is a <span className="text-foreground font-medium">self-evolving multi-agent framework</span> that
              orchestrates specialized AI agents through quality-gated pipelines.
              Every task makes your agents smarter.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-4 pt-2">
              <a
                href="https://github.com/prism-agentic/prism"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 px-6 py-3 bg-prism-cyan text-prism-navy font-semibold rounded-lg hover:shadow-[0_0_30px_oklch(0.78_0.15_200/0.4)] transition-all duration-300"
              >
                <GitBranch className="w-4 h-4" />
                Clone Repository
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </a>
              <button
                onClick={() => document.querySelector("#quickstart")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex items-center gap-2 px-6 py-3 border border-border text-foreground font-medium rounded-lg hover:border-prism-cyan/50 hover:text-prism-cyan transition-all duration-300"
              >
                Quick Start
              </button>
            </div>

            {/* Stats */}
            <div className="flex gap-8 pt-4">
              {[
                { value: "20+", label: "Specialized Agents" },
                { value: "6", label: "Pipeline Phases" },
                { value: "3-Tier", label: "Evolution Engine" },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl font-display font-bold text-prism-cyan">{stat.value}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right visual — 2 cols: Terminal preview */}
          <motion.div
            className="lg:col-span-2 hidden lg:block"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          >
            <div className="glass-card rounded-xl p-1 glow-cyan">
              {/* Terminal header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                </div>
                <span className="text-xs text-muted-foreground font-mono ml-2">prism-cli</span>
              </div>
              {/* Terminal body */}
              <div className="p-4 font-mono text-sm leading-relaxed space-y-1">
                <div className="text-muted-foreground">$ <span className="text-prism-cyan">prism</span> init my-saas-mvp</div>
                <div className="text-muted-foreground/60 text-xs">Initializing PRISM project...</div>
                <div className="text-green-400/80 text-xs">✓ Created prism.yaml</div>
                <div className="text-green-400/80 text-xs">✓ Loaded 20 agents (7 divisions)</div>
                <div className="text-green-400/80 text-xs">✓ Evolution library initialized</div>
                <div className="mt-3 text-muted-foreground">$ <span className="text-prism-cyan">prism</span> agents</div>
                <div className="text-xs text-muted-foreground/80 mt-1">
                  <span className="text-prism-amber">ENGINEERING</span> backend-architect, frontend-developer
                </div>
                <div className="text-xs text-muted-foreground/80">
                  <span className="text-prism-amber">DESIGN</span> ux-architect, ui-designer, brand-guardian
                </div>
                <div className="text-xs text-muted-foreground/80">
                  <span className="text-prism-amber">SPECIALIZED</span> conductor, critic, planner
                </div>
                <div className="mt-3 text-muted-foreground">$ <span className="text-prism-cyan">prism</span> flow start</div>
                <div className="text-xs text-muted-foreground/60">Pipeline pipe-a3f2 created (PRISM-Full)</div>
                <div className="text-xs text-prism-cyan">→ Phase 0: Discover <span className="text-green-400/80">ACTIVE</span></div>
                <div className="mt-1 animate-pulse text-prism-cyan">▌</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
