/*
 * PRISM Features Section — Neural Constellation Design
 * Staggered glass cards with icon accents
 */
import { motion } from "framer-motion";
import {
  Brain,
  Workflow,
  Shield,
  Zap,
  Users,
  RefreshCcw,
  Database,
  Terminal,
} from "lucide-react";

const FEATURES = [
  {
    icon: Users,
    title: "20+ Specialized Agents",
    description:
      "Pre-built agents across 7 divisions — engineering, design, growth, product, operations, and more. Each agent has a distinct personality, expertise, and collaboration graph.",
    color: "cyan" as const,
  },
  {
    icon: Workflow,
    title: "Quality-Gated Pipelines",
    description:
      "PRISM Flow orchestrates work through 6 phases — Discover, Strategize, Scaffold, Build, Harden, Launch — with critic reviews and automatic retry logic at every gate.",
    color: "amber" as const,
  },
  {
    icon: Brain,
    title: "3-Tier Self-Evolution",
    description:
      "L1 micro-tuning adjusts prompts in real-time. L2 distillation refines agent behavior from experience. L3 architecture review restructures the entire agent topology.",
    color: "cyan" as const,
  },
  {
    icon: RefreshCcw,
    title: "Experience Library",
    description:
      "Every decision, success, and failure is recorded in a persistent knowledge base. Agents recall relevant experience before each task, getting smarter over time.",
    color: "amber" as const,
  },
  {
    icon: Shield,
    title: "Drift Detection",
    description:
      "Continuous monitoring of agent performance metrics. When quality degrades, the system automatically flags agents for evolution — before problems compound.",
    color: "cyan" as const,
  },
  {
    icon: Terminal,
    title: "MCP Protocol Native",
    description:
      "Built on the Model Context Protocol standard. Connect PRISM to any MCP-compatible AI tool — Claude, Cursor, Windsurf, or your own custom integration.",
    color: "amber" as const,
  },
  {
    icon: Zap,
    title: "4 Execution Modes",
    description:
      "PRISM-Full for greenfield projects, PRISM-Sprint for features, PRISM-Micro for quick fixes, PRISM-Explore for research. Automatic mode selection based on task analysis.",
    color: "cyan" as const,
  },
  {
    icon: Database,
    title: "Markdown-as-Code Agents",
    description:
      "Agents are defined in version-controlled Markdown files with YAML frontmatter. Edit, fork, and evolve agents like code — because they are code.",
    color: "amber" as const,
  },
];

const colorMap = {
  cyan: {
    iconBg: "bg-prism-cyan/10",
    iconColor: "text-prism-cyan",
    borderHover: "hover:border-prism-cyan/40",
  },
  amber: {
    iconBg: "bg-prism-amber/10",
    iconColor: "text-prism-amber",
    borderHover: "hover:border-prism-amber/40",
  },
};

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 relative">
      {/* Section header */}
      <div className="container mx-auto mb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="max-w-2xl"
        >
          <span className="text-sm font-mono text-prism-cyan tracking-wider uppercase">
            Core Capabilities
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold mt-3 mb-4 text-foreground">
            Everything You Need to Build with{" "}
            <span className="text-gradient-mixed">Living Agents</span>
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            PRISM provides a complete framework for multi-agent orchestration with
            built-in self-evolution. No boilerplate, no glue code — just agents that work.
          </p>
        </motion.div>
      </div>

      {/* Feature grid */}
      <div className="container mx-auto">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((feature, i) => {
            const colors = colorMap[feature.color];
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className={`glass-card rounded-xl p-6 ${colors.borderHover} transition-all duration-300 group`}
              >
                <div className={`w-10 h-10 rounded-lg ${colors.iconBg} flex items-center justify-center mb-4`}>
                  <feature.icon className={`w-5 h-5 ${colors.iconColor}`} />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2 text-sm">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
