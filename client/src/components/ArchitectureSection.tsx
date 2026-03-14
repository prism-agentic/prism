/*
 * PRISM Architecture Section — Neural Constellation Design
 * Showcases the layered architecture with SVG diagram + interactive agent network
 */
import { motion } from "framer-motion";
import { useI18n } from "@/contexts/I18nContext";
import { RichText } from "@/components/RichText";
import AgentNetwork from "@/components/AgentNetwork";
import ArchitectureDiagram from "@/components/ArchitectureDiagram";

const LAYER_KEYS = [
  { nameKey: "arch.layer0.name", descKey: "arch.layer0.desc", isCyan: true },
  { nameKey: "arch.layer1.name", descKey: "arch.layer1.desc", isCyan: false },
  { nameKey: "arch.layer2.name", descKey: "arch.layer2.desc", isCyan: true },
  { nameKey: "arch.layer3.name", descKey: "arch.layer3.desc", isCyan: false },
];

export default function ArchitectureSection() {
  const { t } = useI18n();

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
            {t("arch.label")}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold mt-3 mb-4 text-foreground">
            <RichText text={t("arch.title")} highlightClass="text-gradient-amber" />
          </h2>
          <p className="text-muted-foreground text-lg">
            {t("arch.subtitle")}
          </p>
        </motion.div>

        {/* Content: SVG Diagram + Layers */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Architecture SVG Diagram */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.7 }}
            className="relative"
          >
            <div className="glass-card rounded-xl p-4 glow-amber">
              <ArchitectureDiagram />
            </div>
          </motion.div>

          {/* Layer descriptions */}
          <div className="space-y-5">
            {LAYER_KEYS.map((layer, i) => (
              <motion.div
                key={layer.nameKey}
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
                      {t(layer.nameKey)}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {t(layer.descKey)}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Interactive Agent Network */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="mt-20"
        >
          <div className="text-center mb-6">
            <h3 className="text-xl sm:text-2xl font-display font-bold text-foreground">
              {t("net.section.title")}
            </h3>
            <p className="text-muted-foreground text-sm mt-2 font-mono">
              {t("net.section.desc")}
            </p>
          </div>
          <div className="glass-card rounded-xl p-3 glow-cyan">
            <AgentNetwork />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
