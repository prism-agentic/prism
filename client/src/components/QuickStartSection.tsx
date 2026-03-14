/*
 * PRISM Quick Start Section — Neural Constellation Design
 * Terminal-style code blocks with step-by-step instructions
 */
import { motion } from "framer-motion";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { RichText } from "@/components/RichText";

function CodeBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code.replace(/^[$] /gm, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          </div>
          <span className="text-xs text-muted-foreground font-mono ml-2">{title}</span>
        </div>
        <button
          onClick={handleCopy}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <pre className="p-4 text-sm font-mono overflow-x-auto leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

const STEP_CODES = [
  {
    code: `$ pip install prism-agentic

# Or clone from source
$ git clone https://github.com/prism-agentic/prism.git
$ cd prism && pip install -e ".[dev]"`,
    file: "terminal",
  },
  {
    code: `$ prism init my-project
✓ Created prism.yaml
✓ Loaded 20 agents (7 divisions)
✓ Evolution library initialized

$ prism agents
ENGINEERING  backend-architect, frontend-developer
DESIGN       ux-architect, ui-designer
SPECIALIZED  conductor, critic, planner`,
    file: "terminal",
  },
  {
    code: `{
  "mcpServers": {
    "prism": {
      "command": "python",
      "args": ["-m", "prism.mcp_server"],
      "cwd": "/path/to/my-project"
    }
  }
}`,
    file: "mcp-config.json",
  },
  {
    code: `$ prism flow start --description "Build a SaaS MVP"
Pipeline pipe-a3f2 created (PRISM-Full)
→ Phase 0: Discover ACTIVE

# Agents automatically:
# • Recall relevant experience
# • Execute with critic review
# • Record telemetry for evolution
# • Advance through quality gates`,
    file: "terminal",
  },
];

export default function QuickStartSection() {
  const { t } = useI18n();

  const steps = [0, 1, 2, 3].map((i) => ({
    step: String(i + 1).padStart(2, "0"),
    titleKey: `qs.step${i}.title`,
    descKey: `qs.step${i}.desc`,
    ...STEP_CODES[i],
  }));

  return (
    <section id="quickstart" className="py-24 relative">
      <div className="container mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="text-sm font-mono text-prism-cyan tracking-wider uppercase">
            {t("qs.label")}
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold mt-3 mb-4 text-foreground">
            <RichText text={t("qs.title")} highlightClass="text-gradient-cyan" />
          </h2>
          <p className="text-muted-foreground text-lg">
            {t("qs.subtitle")}
          </p>
        </motion.div>

        {/* Steps */}
        <div className="max-w-3xl mx-auto space-y-10">
          {steps.map((step, i) => (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <div className="flex items-start gap-5 mb-4">
                <div className="w-10 h-10 rounded-xl bg-prism-cyan/10 flex items-center justify-center shrink-0">
                  <span className="text-prism-cyan font-mono text-sm font-bold">{step.step}</span>
                </div>
                <div>
                  <h3 className="font-display font-semibold text-foreground text-lg">
                    {t(step.titleKey)}
                  </h3>
                  <p className="text-muted-foreground text-sm mt-1 leading-relaxed">
                    {t(step.descKey)}
                  </p>
                </div>
              </div>
              <div className="ml-0 sm:ml-15">
                <CodeBlock title={step.file} code={step.code} />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
