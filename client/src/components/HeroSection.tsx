/*
 * PRISM Hero Section — Neural Constellation Design
 * Full-bleed hero with constellation background, asymmetric layout
 */
import { motion } from "framer-motion";

import { useI18n } from "@/contexts/I18nContext";
import { RichText } from "@/components/RichText";
import AnimatedTerminal from "@/components/AnimatedTerminal";

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663287025002/9FCABgkh4qp24hSM32ug7S/prism-hero-bg-ZapLqSCNvV2QuQ9Qbb2Wsk.webp";

export default function HeroSection() {
  const { t, locale } = useI18n();

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: `url(${HERO_BG})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-r from-[#0a0e1a]/95 via-[#0a0e1a]/70 to-[#0a0e1a]/40" />
      <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#0a0e1a] via-transparent to-[#0a0e1a]/50" />

      <div className="relative z-10 container mx-auto pt-32 pb-20">
        <div className="grid lg:grid-cols-5 gap-12 items-center">
          {/* Left content — 3 cols */}
          <motion.div
            className="lg:col-span-3 space-y-8"
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-display font-bold leading-[1.1] tracking-tight">
              <span className="text-foreground">{t("hero.title.line1")}</span>
              <br />
              <span className="text-gradient-cyan">{t("hero.title.learn")}</span>
              <span className="text-foreground">{t("hero.title.comma")}</span>
              <span className="text-gradient-amber">{t("hero.title.evolve")}</span>
              <span className="text-foreground">{t("hero.title.line3")}</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-muted-foreground max-w-xl leading-relaxed">
              <RichText
                text={t("hero.subtitle")}
                highlightClass="text-foreground font-medium"
              />
            </p>



            {/* Stats */}
            <div className="flex gap-8 pt-4">
              {[
                { value: "20+", label: t("hero.stat.agents") },
                { value: "6", label: t("hero.stat.phases") },
                { value: "3-Tier", label: t("hero.stat.evolution") },
              ].map((stat) => (
                <div key={stat.label}>
                  <div className="text-2xl font-display font-bold text-prism-cyan">{stat.value}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right visual — 2 cols: Terminal preview */}
          <motion.div
            className="lg:col-span-2 hidden lg:block"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4, ease: "easeOut" }}
          >
            <AnimatedTerminal locale={locale} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
