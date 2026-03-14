/*
 * PRISM Evolution Section — Neural Constellation Design
 * Showcases the 3-tier self-evolution system with interactive SVG diagram
 */
import { motion } from "framer-motion";
import { useI18n } from "@/contexts/I18nContext";
import { RichText } from "@/components/RichText";
import EvolutionDiagram from "@/components/EvolutionDiagram";

export default function EvolutionSection() {
  const { t } = useI18n();

  return (
    <section id="evolution" className="py-24 relative">
      <div className="container mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <span className="text-sm font-mono text-prism-amber tracking-wider uppercase">
            {t("evo.label")}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold mt-3 mb-4 text-foreground">
            <RichText text={t("evo.title")} highlightClass="text-gradient-amber" />
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            {t("evo.subtitle")}
          </p>
        </motion.div>

        {/* Evolution SVG Diagram with info panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
        >
          <div className="glass-card rounded-xl p-4 sm:p-6 glow-amber">
            <EvolutionDiagram />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
