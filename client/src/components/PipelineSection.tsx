/*
 * PRISM Pipeline Section — Neural Constellation Design
 * Showcases the 6-phase quality-gated pipeline with interactive SVG diagram
 * Bottom info panel auto-cycles and responds to hover
 */
import { motion } from "framer-motion";
import { useI18n } from "@/contexts/I18nContext";
import { RichText } from "@/components/RichText";
import PipelineDiagram from "@/components/PipelineDiagram";

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

        {/* Pipeline SVG Diagram with integrated info panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
        >
          <div className="glass-card rounded-xl p-4 glow-cyan">
            <PipelineDiagram />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
