/*
 * PRISM Docs Page — Neural Constellation Design
 * Documentation hub with sidebar navigation and content sections
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, BookOpen, Layers, Workflow, Brain, Plug, Terminal, ChevronRight, Copy, Check, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import { useI18n } from "@/contexts/I18nContext";
import { Globe } from "lucide-react";

interface DocSection {
  id: string;
  icon: React.ReactNode;
  titleKey: string;
  contentKey: string;
}

const SECTIONS: DocSection[] = [
  { id: "overview", icon: <BookOpen className="w-4 h-4" />, titleKey: "docs.nav.overview", contentKey: "overview" },
  { id: "agents", icon: <Layers className="w-4 h-4" />, titleKey: "docs.nav.agents", contentKey: "agents" },
  { id: "flow", icon: <Workflow className="w-4 h-4" />, titleKey: "docs.nav.flow", contentKey: "flow" },
  { id: "evolution", icon: <Brain className="w-4 h-4" />, titleKey: "docs.nav.evolution", contentKey: "evolution" },
  { id: "mcp", icon: <Plug className="w-4 h-4" />, titleKey: "docs.nav.mcp", contentKey: "mcp" },
  { id: "cli", icon: <Terminal className="w-4 h-4" />, titleKey: "docs.nav.cli", contentKey: "cli" },
];

function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group my-4">
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md bg-prism-navy-lighter/80 text-muted-foreground hover:text-foreground transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <pre className="bg-prism-navy rounded-lg p-4 overflow-x-auto border border-border/50">
        <code className="text-sm font-mono text-prism-cyan/90 leading-relaxed">{code}</code>
      </pre>
    </div>
  );
}

function OverviewContent() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold text-foreground">{t("docs.overview.title")}</h1>
      <p className="text-muted-foreground leading-relaxed text-lg">{t("docs.overview.intro")}</p>
      <div className="grid sm:grid-cols-2 gap-4 my-8">
        {[
          { label: t("docs.overview.feat0"), color: "text-prism-cyan" },
          { label: t("docs.overview.feat1"), color: "text-prism-amber" },
          { label: t("docs.overview.feat2"), color: "text-prism-cyan" },
          { label: t("docs.overview.feat3"), color: "text-prism-amber" },
        ].map((f, i) => (
          <div key={i} className="glass-card rounded-lg p-4 flex items-start gap-3">
            <ChevronRight className={`w-4 h-4 mt-0.5 shrink-0 ${f.color}`} />
            <span className="text-foreground text-sm">{f.label}</span>
          </div>
        ))}
      </div>
      <h2 className="text-xl font-display font-semibold text-foreground mt-8">{t("docs.overview.install")}</h2>
      <CodeBlock code={`# Install from PyPI\npip install prism-agents\n\n# Or clone the repository\ngit clone https://github.com/prism-agentic/prism.git\ncd prism && pip install -e ".[dev]"`} />
      <h2 className="text-xl font-display font-semibold text-foreground mt-8">{t("docs.overview.quickstart")}</h2>
      <CodeBlock code={`# Initialize a new project\nprism init my-project\ncd my-project\n\n# List available agents\nprism agents\n\n# Start a flow\nprism flow start "Build a REST API" --mode sprint`} />
    </div>
  );
}

function AgentsContent() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold text-foreground">{t("docs.agents.title")}</h1>
      <p className="text-muted-foreground leading-relaxed">{t("docs.agents.intro")}</p>
      <h2 className="text-xl font-display font-semibold text-foreground mt-8">{t("docs.agents.divisions")}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-3 px-4 font-mono text-prism-cyan text-xs uppercase tracking-wider">{t("docs.agents.col.division")}</th>
              <th className="text-left py-3 px-4 font-mono text-prism-cyan text-xs uppercase tracking-wider">{t("docs.agents.col.agents")}</th>
              <th className="text-left py-3 px-4 font-mono text-prism-cyan text-xs uppercase tracking-wider">{t("docs.agents.col.purpose")}</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              { div: "Engineering", agents: "backend-architect, frontend-dev, devops", purpose: t("docs.agents.eng") },
              { div: "Design", agents: "ux-architect, ui-designer, brand-guardian", purpose: t("docs.agents.design") },
              { div: "Growth", agents: "growth-hacker, seo-specialist, content-strategist", purpose: t("docs.agents.growth") },
              { div: "Product", agents: "product-manager, feature-analyst", purpose: t("docs.agents.product") },
              { div: "Specialized", agents: "conductor, critic, planner, researcher", purpose: t("docs.agents.specialized") },
            ].map((row, i) => (
              <tr key={i} className="border-b border-border/30">
                <td className="py-3 px-4 font-mono text-prism-amber">{row.div}</td>
                <td className="py-3 px-4 font-mono text-xs">{row.agents}</td>
                <td className="py-3 px-4">{row.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="text-xl font-display font-semibold text-foreground mt-8">{t("docs.agents.define")}</h2>
      <CodeBlock lang="yaml" code={`---\nid: backend-architect\nname: Backend Architect\ndivision: engineering\nrole: Senior Backend Architect\nversion: 1.0.0\nevolution:\n  generation: 1\n  last_distillation: null\n  performance:\n    first_pass_rate: null\n    avg_quality_score: null\ncollaboration:\n  reports_to: conductor\n  works_with: [frontend-dev, devops]\n---\n\n# Backend Architect\n\n## Identity\nYou are the Backend Architect...\n\n## Core Competencies\n- System design and API architecture\n- Database modeling and optimization\n- Performance and scalability patterns`} />
    </div>
  );
}

function FlowContent() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold text-foreground">{t("docs.flow.title")}</h1>
      <p className="text-muted-foreground leading-relaxed">{t("docs.flow.intro")}</p>
      <h2 className="text-xl font-display font-semibold text-foreground mt-8">{t("docs.flow.modes")}</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        {[
          { name: "PRISM-Full", desc: t("docs.flow.full"), color: "border-prism-cyan/30" },
          { name: "PRISM-Sprint", desc: t("docs.flow.sprint"), color: "border-prism-amber/30" },
          { name: "PRISM-Micro", desc: t("docs.flow.micro"), color: "border-prism-cyan/30" },
          { name: "PRISM-Explore", desc: t("docs.flow.explore"), color: "border-prism-amber/30" },
        ].map((m, i) => (
          <div key={i} className={`glass-card rounded-lg p-4 border ${m.color}`}>
            <h3 className="font-mono font-bold text-foreground mb-1">{m.name}</h3>
            <p className="text-muted-foreground text-sm">{m.desc}</p>
          </div>
        ))}
      </div>
      <h2 className="text-xl font-display font-semibold text-foreground mt-8">{t("docs.flow.phases")}</h2>
      <CodeBlock code={`# Start a full pipeline\nprism flow start "Build an e-commerce platform" --mode full\n\n# Check pipeline status\nprism flow status <pipeline-id>\n\n# Advance to next phase (after quality gate passes)\nprism flow advance <pipeline-id>`} />
    </div>
  );
}

function EvolutionContent() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold text-foreground">{t("docs.evo.title")}</h1>
      <p className="text-muted-foreground leading-relaxed">{t("docs.evo.intro")}</p>
      <h2 className="text-xl font-display font-semibold text-foreground mt-8">{t("docs.evo.tiers")}</h2>
      {[
        { tier: "L1", name: t("docs.evo.l1.name"), desc: t("docs.evo.l1.desc"), color: "text-green-400" },
        { tier: "L2", name: t("docs.evo.l2.name"), desc: t("docs.evo.l2.desc"), color: "text-prism-cyan" },
        { tier: "L3", name: t("docs.evo.l3.name"), desc: t("docs.evo.l3.desc"), color: "text-prism-amber" },
      ].map((t, i) => (
        <div key={i} className="glass-card rounded-lg p-5">
          <div className="flex items-center gap-3 mb-2">
            <span className={`font-mono font-bold ${t.color}`}>{t.tier}</span>
            <h3 className="font-display font-semibold text-foreground">{t.name}</h3>
          </div>
          <p className="text-muted-foreground text-sm leading-relaxed">{t.desc}</p>
        </div>
      ))}
      <h2 className="text-xl font-display font-semibold text-foreground mt-8">{t("docs.evo.usage")}</h2>
      <CodeBlock code={`# Record an experience\nprism evolution record --agent backend-architect \\\n  --outcome success --lesson "Pagination with cursor-based approach"\n\n# Trigger distillation\nprism evolution distill --agent backend-architect\n\n# Check drift status\nprism evolution drift --agent backend-architect`} />
    </div>
  );
}

function MCPContent() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold text-foreground">{t("docs.mcp.title")}</h1>
      <p className="text-muted-foreground leading-relaxed">{t("docs.mcp.intro")}</p>
      <h2 className="text-xl font-display font-semibold text-foreground mt-8">{t("docs.mcp.config")}</h2>
      <CodeBlock lang="json" code={`{\n  "mcpServers": {\n    "prism": {\n      "command": "python",\n      "args": ["-m", "prism.mcp_server"],\n      "cwd": "/path/to/your/project"\n    }\n  }\n}`} />
      <h2 className="text-xl font-display font-semibold text-foreground mt-8">{t("docs.mcp.tools")}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border/50">
              <th className="text-left py-3 px-4 font-mono text-prism-cyan text-xs uppercase tracking-wider">{t("docs.mcp.col.tool")}</th>
              <th className="text-left py-3 px-4 font-mono text-prism-cyan text-xs uppercase tracking-wider">{t("docs.mcp.col.desc")}</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              { tool: "list_agents", desc: t("docs.mcp.t0") },
              { tool: "get_agent", desc: t("docs.mcp.t1") },
              { tool: "run_flow", desc: t("docs.mcp.t2") },
              { tool: "check_status", desc: t("docs.mcp.t3") },
              { tool: "recall_experience", desc: t("docs.mcp.t4") },
              { tool: "record_experience", desc: t("docs.mcp.t5") },
              { tool: "trigger_evolution", desc: t("docs.mcp.t6") },
              { tool: "get_metrics", desc: t("docs.mcp.t7") },
            ].map((row, i) => (
              <tr key={i} className="border-b border-border/30">
                <td className="py-3 px-4 font-mono text-prism-amber">{row.tool}</td>
                <td className="py-3 px-4">{row.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CLIContent() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-display font-bold text-foreground">{t("docs.cli.title")}</h1>
      <p className="text-muted-foreground leading-relaxed">{t("docs.cli.intro")}</p>
      <CodeBlock code={`# Project management\nprism init <project-name>    # Create new project\nprism version                # Show version\n\n# Agent management\nprism agents                 # List all agents\nprism agent <id>             # Show agent details\n\n# Flow engine\nprism flow start <desc>      # Start pipeline\nprism flow status <id>       # Check status\nprism flow advance <id>      # Advance phase\n\n# Evolution\nprism evolution record ...   # Record experience\nprism evolution distill ...  # Trigger distillation\nprism evolution drift ...    # Check drift\n\n# MCP Server\nprism mcp serve              # Start MCP server`} />
    </div>
  );
}

const CONTENT_MAP: Record<string, React.FC> = {
  overview: OverviewContent,
  agents: AgentsContent,
  flow: FlowContent,
  evolution: EvolutionContent,
  mcp: MCPContent,
  cli: CLIContent,
};

export default function Docs() {
  const [activeSection, setActiveSection] = useState("overview");
  const { t, locale, toggleLocale } = useI18n();
  const ContentComponent = CONTENT_MAP[activeSection];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-card border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-mono">{t("docs.back")}</span>
            </Link>
            <div className="h-5 w-px bg-border/50" />
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-gradient-to-br from-prism-cyan to-prism-amber flex items-center justify-center">
                <Terminal className="w-3 h-3 text-prism-navy" strokeWidth={2.5} />
              </div>
              <span className="font-display font-bold text-sm text-foreground">PRISM Docs</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLocale}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono border border-border/50 rounded-md hover:border-prism-cyan/30"
            >
              <Globe className="w-3 h-3" />
              {locale === "zh" ? "EN" : "中文"}
            </button>
            <a
              href="https://github.com/prism-agentic/prism"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
            >
              <ExternalLink className="w-3 h-3" />
              GitHub
            </a>
          </div>
        </div>
      </header>

      <div className="flex pt-14">
        {/* Sidebar */}
        <aside className="hidden md:block w-64 shrink-0 border-r border-border/50 h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto">
          <nav className="p-4 space-y-1">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  activeSection === section.id
                    ? "bg-prism-cyan/10 text-prism-cyan border border-prism-cyan/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                {section.icon}
                <span className="font-mono">{t(section.titleKey)}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-card border-t border-border/50 px-2 py-2 flex gap-1 overflow-x-auto">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-all ${
                activeSection === section.id
                  ? "bg-prism-cyan/10 text-prism-cyan border border-prism-cyan/20"
                  : "text-muted-foreground"
              }`}
            >
              {section.icon}
              <span className="hidden sm:inline">{t(section.titleKey)}</span>
            </button>
          ))}
        </div>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-6 sm:px-8 lg:px-12 py-8 pb-24 md:pb-8 max-w-4xl">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <ContentComponent />
          </motion.div>
        </main>
      </div>
    </div>
  );
}
