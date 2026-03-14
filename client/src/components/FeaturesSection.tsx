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
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { RichText } from "@/components/RichText";

interface FeatureDef {
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  color: "cyan" | "amber";
}

const FEATURES: FeatureDef[] = [
  { icon: Users, titleKey: "features.0.title", descKey: "features.0.desc", color: "cyan" },
  { icon: Workflow, titleKey: "features.1.title", descKey: "features.1.desc", color: "amber" },
  { icon: Brain, titleKey: "features.2.title", descKey: "features.2.desc", color: "cyan" },
  { icon: RefreshCcw, titleKey: "features.3.title", descKey: "features.3.desc", color: "amber" },
  { icon: Shield, titleKey: "features.4.title", descKey: "features.4.desc", color: "cyan" },
  { icon: Terminal, titleKey: "features.5.title", descKey: "features.5.desc", color: "amber" },
  { icon: Zap, titleKey: "features.6.title", descKey: "features.6.desc", color: "cyan" },
  { icon: Database, titleKey: "features.7.title", descKey: "features.7.desc", color: "amber" },
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
  const { t } = useI18n();

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
            {t("features.label")}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold mt-3 mb-4 text-foreground">
            <RichText text={t("features.title")} />
          </h2>
          <p className="text-muted-foreground text-lg leading-relaxed">
            {t("features.subtitle")}
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
                key={feature.titleKey}
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
                  {t(feature.titleKey)}
                </h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {t(feature.descKey)}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
