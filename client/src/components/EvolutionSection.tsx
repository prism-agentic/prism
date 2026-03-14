/*
 * PRISM Evolution Section — Neural Constellation Design
 * Showcases the 3-tier self-evolution system
 */
import { motion } from "framer-motion";
import { Cpu, Layers, Network, type LucideIcon } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";
import { RichText } from "@/components/RichText";

const EVOLUTION_IMG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663287025002/9FCABgkh4qp24hSM32ug7S/prism-evolution-a2bvTWnuL9jWsMcfgKzGeh.webp";

interface TierDef {
  icon: LucideIcon;
  level: string;
  nameKey: string;
  descKey: string;
  metricKeys: string[];
  isCyan: boolean;
}

const TIERS: TierDef[] = [
  {
    icon: Cpu,
    level: "L1",
    nameKey: "evo.tier0.name",
    descKey: "evo.tier0.desc",
    metricKeys: ["evo.tier0.m0", "evo.tier0.m1", "evo.tier0.m2"],
    isCyan: true,
  },
  {
    icon: Layers,
    level: "L2",
    nameKey: "evo.tier1.name",
    descKey: "evo.tier1.desc",
    metricKeys: ["evo.tier1.m0", "evo.tier1.m1", "evo.tier1.m2"],
    isCyan: false,
  },
  {
    icon: Network,
    level: "L3",
    nameKey: "evo.tier2.name",
    descKey: "evo.tier2.desc",
    metricKeys: ["evo.tier2.m0", "evo.tier2.m1", "evo.tier2.m2"],
    isCyan: true,
  },
];

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
          className="max-w-2xl mb-16"
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
              alt="PRISM Evolution"
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
                    {t(tier.nameKey)}
                  </h3>
                </div>
              </div>

              <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                {t(tier.descKey)}
              </p>

              {/* Metrics */}
              <ul className="space-y-2">
                {tier.metricKeys.map((mk) => (
                  <li key={mk} className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
                    <div className={`w-1.5 h-1.5 rounded-full ${tier.isCyan ? "bg-prism-cyan/60" : "bg-prism-amber/60"}`} />
                    {t(mk)}
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
