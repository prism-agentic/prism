/*
 * PRISM Evolution Section — Neural Constellation Design
 * Showcases the 3-tier self-evolution system
 */
import { motion } from "framer-motion";
import { Cpu, Layers, Network, type LucideIcon } from "lucide-react";

const EVOLUTION_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663287025002/9FCABgkh4qp24hSM32ug7S/prism-evolution-a2bvTWnuL9jWsMcfgKzGeh.webp";

interface Tier {
  icon: LucideIcon;
  level: string;
  name: string;
  desc: string;
  metrics: string[];
  isCyan: boolean;
}

const TIERS: Tier[] = [
  {
    icon: Cpu,
    level: "L1",
    name: "Micro-Tuning",
    desc: "Real-time prompt adjustments based on immediate task feedback. The system records what works and what doesn't, building a library of principles that agents recall before each task.",
    metrics: ["First-pass rate tracking", "Automatic principle extraction", "Context-aware recall"],
    isCyan: true,
  },
  {
    icon: Layers,
    level: "L2",
    name: "Distillation",
    desc: "Periodic refinement of agent system prompts by analyzing accumulated experience. When enough evidence accumulates, the distillation engine rewrites agent instructions to encode learned patterns.",
    metrics: ["Experience-driven rewriting", "A/B prompt testing", "Regression detection"],
    isCyan: false,
  },
  {
    icon: Network,
    level: "L3",
    name: "Architecture Review",
    desc: "Structural evolution of the entire agent topology. The system can propose new agents, merge redundant ones, or restructure collaboration graphs based on long-term performance data.",
    metrics: ["Agent topology optimization", "Division restructuring", "Collaboration graph evolution"],
    isCyan: true,
  },
];

export default function EvolutionSection() {
  return (
    <section id="evolution" className="py-24 relative">
      <div className="container mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl mb-16"
        >
          <span className="text-sm font-mono text-prism-amber tracking-wider uppercase">
            Self-Evolution Engine
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold mt-3 mb-4 text-foreground">
            Every Task Makes Your Agents{" "}
            <span className="text-gradient-amber">Smarter</span>
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            PRISM's 3-tier evolution system continuously improves agent performance —
            from micro-adjustments to full architectural restructuring.
          </p>
        </motion.div>

        {/* Evolution image */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="mb-16"
        >
          <div className="glass-card rounded-xl p-2 glow-amber">
            <img
              src={EVOLUTION_IMG}
              alt="PRISM Evolution — three stages of transformation from simple to complex to radiant"
              className="rounded-lg w-full"
              loading="lazy"
            />
          </div>
        </motion.div>

        {/* Tier cards */}
        <div className="grid lg:grid-cols-3 gap-6">
          {TIERS.map((tier, i) => (
            <motion.div
              key={tier.level}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className={`glass-card rounded-xl p-6 transition-all duration-300 ${tier.isCyan ? "hover:border-prism-cyan/40" : "hover:border-prism-amber/40"}`}
            >
              {/* Level badge */}
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tier.isCyan ? "bg-prism-cyan/10" : "bg-prism-amber/10"}`}>
                  <tier.icon className={`w-5 h-5 ${tier.isCyan ? "text-prism-cyan" : "text-prism-amber"}`} />
                </div>
                <div>
                  <div className={`text-xs font-mono font-semibold ${tier.isCyan ? "text-prism-cyan" : "text-prism-amber"}`}>
                    {tier.level}
                  </div>
                  <h3 className="font-display font-semibold text-foreground">
                    {tier.name}
                  </h3>
                </div>
              </div>

              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                {tier.desc}
              </p>

              {/* Metrics */}
              <ul className="space-y-2">
                {tier.metrics.map((metric) => (
                  <li key={metric} className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                    <div className={`w-1.5 h-1.5 rounded-full ${tier.isCyan ? "bg-prism-cyan/60" : "bg-prism-amber/60"}`} />
                    {metric}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
