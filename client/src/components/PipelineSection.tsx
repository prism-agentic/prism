/*
 * PRISM Pipeline Section — Neural Constellation Design
 * Showcases the 6-phase quality-gated pipeline
 */
import { motion } from "framer-motion";
import { Search, Target, Layers, Hammer, ShieldCheck, Rocket } from "lucide-react";

const PIPELINE_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663287025002/9FCABgkh4qp24hSM32ug7S/prism-flow-pipeline-HARo9g2Ut5rrobuYfQvfcj.webp";

const PHASES = [
  {
    icon: Search,
    name: "Discover",
    gate: "Requirements Met",
    desc: "Stakeholder analysis, scope definition, risk assessment",
  },
  {
    icon: Target,
    name: "Strategize",
    gate: "Plan Approved",
    desc: "Architecture decisions, technology selection, timeline",
  },
  {
    icon: Layers,
    name: "Scaffold",
    gate: "Architecture Validated",
    desc: "Project structure, CI/CD setup, dependency management",
  },
  {
    icon: Hammer,
    name: "Build",
    gate: "Code Review Passed",
    desc: "Feature implementation with critic review loops",
  },
  {
    icon: ShieldCheck,
    name: "Harden",
    gate: "Security Audited",
    desc: "Testing, security audit, performance optimization",
  },
  {
    icon: Rocket,
    name: "Launch",
    gate: "Deploy Ready",
    desc: "Documentation, deployment, monitoring setup",
  },
];

export default function PipelineSection() {
  return (
    <section id="pipeline" className="py-24 relative">
      <div className="container mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-12"
        >
          <span className="text-sm font-mono text-prism-cyan tracking-wider uppercase">
            PRISM Flow
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold mt-3 mb-4 text-foreground">
            Quality Gates at{" "}
            <span className="text-gradient-cyan">Every Phase</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Work flows through 6 phases, each with a dedicated quality gate.
            Nothing advances until the critic agent approves.
          </p>
        </motion.div>

        {/* Pipeline image */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="mb-16"
        >
          <div className="glass-card rounded-xl p-2 glow-cyan">
            <img
              src={PIPELINE_IMG}
              alt="PRISM Flow Pipeline — 6 phases from Discover to Launch with quality gates"
              className="rounded-lg w-full"
              loading="lazy"
            />
          </div>
        </motion.div>

        {/* Phase cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PHASES.map((phase, i) => (
            <motion.div
              key={phase.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="glass-card rounded-xl p-5 hover:border-prism-cyan/30 transition-all duration-300 group"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-prism-cyan/10 flex items-center justify-center">
                  <phase.icon className="w-4.5 h-4.5 text-prism-cyan" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground text-sm">
                    Phase {i}: {phase.name}
                  </h3>
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-3 leading-relaxed">
                {phase.desc}
              </p>
              <div className="flex items-center gap-2 text-xs font-mono">
                <div className="w-2 h-2 rounded-full bg-green-400/80" />
                <span className="text-green-400/80">Gate: {phase.gate}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
