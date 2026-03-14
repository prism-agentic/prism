/*
 * PRISM Architecture Section — Neural Constellation Design
 * Showcases the layered architecture with generated visual
 */
import { motion } from "framer-motion";

const ARCH_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663287025002/9FCABgkh4qp24hSM32ug7S/prism-architecture-kbKQ8nXipHruTLeYyeezwM.webp";

const LAYERS = [
  {
    name: "Agent Layer",
    desc: "20+ specialized agents defined in Markdown with YAML frontmatter. Each has personality, expertise, collaboration rules, and evolution metadata.",
    isCyan: true,
  },
  {
    name: "Flow Engine",
    desc: "NEXUS orchestration engine with 4 execution modes, 6 pipeline phases, quality gates, and automatic critic review loops.",
    isCyan: false,
  },
  {
    name: "Evolution Core",
    desc: "3-tier self-improvement: L1 micro-tuning, L2 distillation from experience, L3 architecture review. Persistent experience library with drift detection.",
    isCyan: true,
  },
  {
    name: "MCP Interface",
    desc: "Standard Model Context Protocol server exposing 8 tools. Connect to Claude, Cursor, Windsurf, or any MCP-compatible AI tool.",
    isCyan: false,
  },
];

export default function ArchitectureSection() {
  return (
    <section id="architecture" className="py-24 relative">
      <div className="container mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="text-sm font-mono text-prism-amber tracking-wider uppercase">
            System Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold mt-3 mb-4 text-foreground">
            Layered by Design,{" "}
            <span className="text-gradient-amber">Evolved by Nature</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Four interconnected layers work together to create a system that improves
            with every interaction.
          </p>
        </motion.div>

        {/* Content: Image + Layers */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Architecture image */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            <div className="glass-card rounded-xl p-2 glow-amber">
              <img
                src={ARCH_IMG}
                alt="PRISM Architecture — layered hexagonal structure showing agent network, data processing, knowledge base, algorithm optimization, and decision core"
                className="rounded-lg w-full"
                loading="lazy"
              />
            </div>
          </motion.div>

          {/* Layer descriptions */}
          <div className="space-y-5">
            {LAYERS.map((layer, i) => (
              <motion.div
                key={layer.name}
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="glass-card rounded-xl p-5 group hover:border-prism-cyan/30 transition-all duration-300"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${layer.isCyan ? "bg-prism-cyan/10" : "bg-prism-amber/10"}`}>
                    <span className={`font-mono text-sm font-bold ${layer.isCyan ? "text-prism-cyan" : "text-prism-amber"}`}>
                      {i + 1}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-foreground mb-1">
                      {layer.name}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {layer.desc}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
