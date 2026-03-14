/*
 * PRISM Pipeline Section — Neural Constellation Design
 * Showcases the 6-phase quality-gated pipeline
 */
import { motion } from "framer-motion";
import { Search, Target, Layers, Hammer, ShieldCheck, Rocket, type LucideIcon } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { RichText } from "@/components/RichText";

const PIPELINE_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663287025002/9FCABgkh4qp24hSM32ug7S/prism-flow-pipeline-HARo9g2Ut5rrobuYfQvfcj.webp";

interface PhaseDef {
  icon: LucideIcon;
  nameKey: string;
  gateKey: string;
  descKey: string;
}

const PHASES: PhaseDef[] = [
  { icon: Search, nameKey: "pipeline.phase0.name", gateKey: "pipeline.phase0.gate", descKey: "pipeline.phase0.desc" },
  { icon: Target, nameKey: "pipeline.phase1.name", gateKey: "pipeline.phase1.gate", descKey: "pipeline.phase1.desc" },
  { icon: Layers, nameKey: "pipeline.phase2.name", gateKey: "pipeline.phase2.gate", descKey: "pipeline.phase2.desc" },
  { icon: Hammer, nameKey: "pipeline.phase3.name", gateKey: "pipeline.phase3.gate", descKey: "pipeline.phase3.desc" },
  { icon: ShieldCheck, nameKey: "pipeline.phase4.name", gateKey: "pipeline.phase4.gate", descKey: "pipeline.phase4.desc" },
  { icon: Rocket, nameKey: "pipeline.phase5.name", gateKey: "pipeline.phase5.gate", descKey: "pipeline.phase5.desc" },
];

export default function PipelineSection() {
  const { t } = useI18n();

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
            {t("pipeline.label")}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold mt-3 mb-4 text-foreground">
            <RichText text={t("pipeline.title")} highlightClass="text-gradient-cyan" />
          </h2>
          <p className="text-muted-foreground text-lg">
            {t("pipeline.subtitle")}
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
              alt="PRISM Flow Pipeline"
              className="rounded-lg w-full"
              loading="lazy"
            />
          </div>
        </motion.div>

        {/* Phase cards */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PHASES.map((phase, i) => (
            <motion.div
              key={phase.nameKey}
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
                    Phase {i}: {t(phase.nameKey)}
                  </h3>
                </div>
              </div>
              <p className="text-muted-foreground text-sm mb-3 leading-relaxed">
                {t(phase.descKey)}
              </p>
              <div className="flex items-center gap-2 text-xs font-mono">
                <div className="w-2 h-2 rounded-full bg-green-400/80" />
                <span className="text-green-400/80">Gate: {t(phase.gateKey)}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
