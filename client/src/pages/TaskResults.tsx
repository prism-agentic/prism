import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useState, useMemo } from "react";
import { Link, useParams } from "wouter";
import { Streamdown } from "streamdown";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Download,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  FileText,
  Code2,
  Palette,
  Rocket,
  Shield,
  Search,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Timer,
  Zap,
  Bot,
} from "lucide-react";

// ─── Agent Category Mapping ────────────────────────────────────────
interface AgentMeta {
  name: string;
  icon: React.ReactNode;
  color: string;
  category: string;
  categoryLabel: string;
  description: string;
}

const AGENT_META: Record<string, AgentMeta> = {
  conductor: {
    name: "Conductor",
    icon: <Zap className="w-4 h-4" />,
    color: "#00d4ff",
    category: "planning",
    categoryLabel: "Planning & Discovery",
    description: "Task decomposition and orchestration",
  },
  researcher: {
    name: "Researcher",
    icon: <Search className="w-4 h-4" />,
    color: "#00d4ff",
    category: "planning",
    categoryLabel: "Planning & Discovery",
    description: "Technology research and market analysis",
  },
  pm: {
    name: "Product Manager",
    icon: <FileText className="w-4 h-4" />,
    color: "#f59e0b",
    category: "requirements",
    categoryLabel: "Requirements & Design",
    description: "User stories, MVP scope, and success metrics",
  },
  ux: {
    name: "UX Designer",
    icon: <Palette className="w-4 h-4" />,
    color: "#f59e0b",
    category: "requirements",
    categoryLabel: "Requirements & Design",
    description: "Information architecture and visual design",
  },
  backend: {
    name: "Backend Architect",
    icon: <Settings className="w-4 h-4" />,
    color: "#10b981",
    category: "technical",
    categoryLabel: "Technical Design",
    description: "Database schema, API design, and architecture",
  },
  frontend: {
    name: "Frontend Developer",
    icon: <Code2 className="w-4 h-4" />,
    color: "#10b981",
    category: "technical",
    categoryLabel: "Technical Design",
    description: "Component architecture and UI implementation",
  },
  devops: {
    name: "DevOps Engineer",
    icon: <Rocket className="w-4 h-4" />,
    color: "#10b981",
    category: "technical",
    categoryLabel: "Technical Design",
    description: "CI/CD pipeline and infrastructure",
  },
  critic: {
    name: "Quality Critic",
    icon: <Shield className="w-4 h-4" />,
    color: "#a855f7",
    category: "quality",
    categoryLabel: "Quality & Growth",
    description: "Code review and security assessment",
  },
  growth: {
    name: "Growth Hacker",
    icon: <BarChart3 className="w-4 h-4" />,
    color: "#a855f7",
    category: "quality",
    categoryLabel: "Quality & Growth",
    description: "Launch strategy and growth tactics",
  },
};

const CATEGORIES = [
  { id: "all", label: "All Deliverables", icon: <Bot className="w-4 h-4" /> },
  { id: "planning", label: "Planning", icon: <Search className="w-4 h-4" /> },
  { id: "requirements", label: "Requirements", icon: <FileText className="w-4 h-4" /> },
  { id: "technical", label: "Technical", icon: <Code2 className="w-4 h-4" /> },
  { id: "quality", label: "Quality & Growth", icon: <Shield className="w-4 h-4" /> },
];

// ─── Helper: Copy to Clipboard ─────────────────────────────────────
function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-card hover:border-prism-cyan/30 transition-all"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied!" : label}
    </button>
  );
}

// ─── Deliverable Card Component ────────────────────────────────────
function DeliverableCard({
  agentRole,
  content,
  durationMs,
  isExpanded,
  onToggle,
}: {
  agentRole: string;
  content: string;
  durationMs: number | null;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const meta = AGENT_META[agentRole] || {
    name: agentRole,
    icon: <Bot className="w-4 h-4" />,
    color: "#888",
    category: "other",
    categoryLabel: "Other",
    description: "",
  };

  return (
    <div className="rounded-xl border border-border/50 bg-card/30 hover:border-border transition-all overflow-hidden">
      {/* Card Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-card/50 transition-colors"
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${meta.color}15`, border: `1px solid ${meta.color}30`, color: meta.color }}
        >
          {meta.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm" style={{ color: meta.color }}>
              {meta.name}
            </span>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {meta.categoryLabel}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {durationMs && (
            <span className="text-[10px] text-muted-foreground/60 font-mono flex items-center gap-1">
              <Timer className="w-3 h-3" />
              {(durationMs / 1000).toFixed(1)}s
            </span>
          )}
          <span className="text-xs text-muted-foreground/60 font-mono">
            {(content.length / 1000).toFixed(1)}k chars
          </span>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border/30">
          {/* Action Bar */}
          <div className="flex items-center gap-2 px-4 py-2 bg-background/30 border-b border-border/20">
            <CopyButton text={content} label="Copy Markdown" />
            <button
              onClick={() => downloadMarkdown(content, `${meta.name.toLowerCase().replace(/\s+/g, "-")}-output.md`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-card hover:border-prism-cyan/30 transition-all"
            >
              <Download className="w-3 h-3" />
              Download .md
            </button>
          </div>

          {/* Markdown Content */}
          <div className="p-5">
            <div className="prose prose-invert prose-sm max-w-none
              prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
              prose-p:text-foreground/80 prose-p:leading-relaxed
              prose-li:text-foreground/80
              prose-code:text-prism-cyan prose-code:bg-prism-cyan/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
              prose-pre:bg-[#0a1628] prose-pre:border prose-pre:border-border/30 prose-pre:rounded-lg
              prose-strong:text-foreground
              prose-a:text-prism-cyan prose-a:no-underline hover:prose-a:underline
              prose-table:border-collapse
              prose-th:border prose-th:border-border/30 prose-th:px-3 prose-th:py-2 prose-th:bg-card/50
              prose-td:border prose-td:border-border/30 prose-td:px-3 prose-td:py-2
            ">
              <Streamdown>{content}</Streamdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper: Download Markdown ─────────────────────────────────────
function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Helper: Build Full Export Markdown ─────────────────────────────
function buildFullExport(
  taskPrompt: string,
  deliverables: Array<{ agentRole: string; content: string; durationMs: number | null }>,
): string {
  const lines: string[] = [];
  lines.push(`# PRISM Task Report`);
  lines.push("");
  lines.push(`> **Task:** ${taskPrompt}`);
  lines.push(`> **Generated by:** PRISM Multi-Agent Framework`);
  lines.push(`> **Date:** ${new Date().toLocaleDateString()}`);
  lines.push(`> **Agents Used:** ${deliverables.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const d of deliverables) {
    const meta = AGENT_META[d.agentRole];
    const name = meta?.name ?? d.agentRole;
    const desc = meta?.description ?? "";
    lines.push(`## ${name}`);
    if (desc) lines.push(`*${desc}*`);
    if (d.durationMs) lines.push(`*Processing time: ${(d.durationMs / 1000).toFixed(1)}s*`);
    lines.push("");
    lines.push(d.content);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

// ─── Main Page Component ───────────────────────────────────────────
export default function TaskResults() {
  const params = useParams<{ taskId: string }>();
  const taskId = parseInt(params.taskId || "0");
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [activeCategory, setActiveCategory] = useState("all");

  const taskQuery = trpc.task.get.useQuery({ id: taskId }, { enabled: isAuthenticated && taskId > 0 });
  const logsQuery = trpc.task.logs.useQuery({ taskId }, { enabled: isAuthenticated && taskId > 0 });

  // Extract "done" logs with content as deliverables
  const deliverables = useMemo(() => {
    if (!logsQuery.data) return [];
    const logs = logsQuery.data as Array<{
      id: number;
      agentRole: string;
      agentName: string;
      content: string | null;
      status: string;
      durationMs: number | null;
      phase: number | null;
    }>;

    // Get unique "done" logs with content, preferring later entries (build phase outputs)
    const seen = new Map<string, typeof logs[0]>();
    for (const log of logs) {
      if (log.status === "done" && log.content && log.content.length > 50) {
        // Use agentRole + phase as key to keep both scaffold and build outputs
        const key = `${log.agentRole}_${log.phase}`;
        seen.set(key, log);
      }
    }
    return Array.from(seen.values());
  }, [logsQuery.data]);

  // Filter by category
  const filteredDeliverables = useMemo(() => {
    if (activeCategory === "all") return deliverables;
    return deliverables.filter(d => {
      const meta = AGENT_META[d.agentRole];
      return meta?.category === activeCategory;
    });
  }, [deliverables, activeCategory]);

  // Stats
  const totalDuration = useMemo(() => {
    return deliverables.reduce((sum, d) => sum + (d.durationMs || 0), 0);
  }, [deliverables]);

  const totalChars = useMemo(() => {
    return deliverables.reduce((sum, d) => sum + (d.content?.length || 0), 0);
  }, [deliverables]);

  const toggleCard = (key: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedCards(new Set(filteredDeliverables.map(d => `${d.agentRole}_${d.phase}`)));
  };

  const collapseAll = () => {
    setExpandedCards(new Set());
  };

  // Auth redirect
  if (!authLoading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  // Loading state
  if (authLoading || taskQuery.isLoading || logsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-prism-cyan/30 border-t-prism-cyan rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground font-mono">Loading results...</span>
        </div>
      </div>
    );
  }

  const task = taskQuery.data as {
    id: number;
    prompt: string;
    status: string;
    currentPhase: number | null;
    totalPhases: number | null;
    result: Record<string, unknown> | null;
    startedAt: Date | null;
    completedAt: Date | null;
    projectId: number;
  } | undefined;

  if (!task) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Task not found</h2>
          <Link href="/dashboard" className="text-prism-cyan hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const isCompleted = task.status === "completed";
  const isRunning = task.status === "running";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Nav */}
      <nav className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href={`/workspace/${task.projectId}`}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm hidden sm:inline">Workspace</span>
            </Link>
            <ChevronRight className="w-3 h-3 text-border" />
            <span className="font-display font-semibold text-sm">Task Results</span>
            {isRunning && (
              <span className="flex items-center gap-1 text-xs text-prism-cyan">
                <span className="w-1.5 h-1.5 rounded-full bg-prism-cyan animate-pulse" />
                In Progress...
              </span>
            )}
          </div>
          {isCompleted && deliverables.length > 0 && (
            <button
              onClick={() => {
                const md = buildFullExport(
                  task.prompt,
                  deliverables.map(d => ({
                    agentRole: d.agentRole,
                    content: d.content || "",
                    durationMs: d.durationMs,
                  })),
                );
                downloadMarkdown(md, `prism-report-${task.id}.md`);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-prism-cyan text-prism-navy font-semibold rounded-lg hover:bg-prism-cyan/90 transition-colors text-sm"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export Full Report</span>
              <span className="sm:hidden">Export</span>
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Task Overview Card */}
        <div className="glass-card rounded-xl p-6 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                ) : isRunning ? (
                  <Loader2 className="w-5 h-5 text-prism-cyan animate-spin flex-shrink-0" />
                ) : (
                  <Clock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                )}
                <Badge
                  variant={isCompleted ? "default" : "outline"}
                  className={isCompleted ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : ""}
                >
                  {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
                </Badge>
              </div>
              <h1 className="text-lg font-display font-bold mb-1 break-words">{task.prompt}</h1>
              <p className="text-sm text-muted-foreground">
                {isCompleted
                  ? `Completed by ${deliverables.length} AI agents across 6 pipeline phases`
                  : isRunning
                  ? "AI agents are currently working on this task..."
                  : "Task is queued for processing"}
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 flex-shrink-0">
              <div className="text-center p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-lg font-bold text-prism-cyan">{deliverables.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Agents</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-lg font-bold text-prism-amber">6</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Phases</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-lg font-bold text-foreground">{(totalDuration / 1000).toFixed(0)}s</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Time</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-lg font-bold text-foreground">{(totalChars / 1000).toFixed(1)}k</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Characters</p>
              </div>
            </div>
          </div>

          {/* Pipeline Progress */}
          {isRunning && (
            <div className="mt-4 pt-4 border-t border-border/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Pipeline Progress</span>
                <span className="text-xs font-mono text-prism-cyan">
                  Phase {(task.currentPhase || 0) + 1} / {task.totalPhases || 6}
                </span>
              </div>
              <Progress
                value={((task.currentPhase || 0) / (task.totalPhases || 6)) * 100}
                className="h-2 bg-border/30"
              />
            </div>
          )}
        </div>

        {/* Category Tabs + Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full sm:w-auto">
            <TabsList className="bg-card/50 border border-border/30 h-10 w-full sm:w-auto overflow-x-auto">
              {CATEGORIES.map(cat => (
                <TabsTrigger
                  key={cat.id}
                  value={cat.id}
                  className="text-xs gap-1.5 data-[state=active]:bg-prism-cyan/10 data-[state=active]:text-prism-cyan data-[state=active]:border-prism-cyan/30 px-3"
                >
                  {cat.icon}
                  <span className="hidden sm:inline">{cat.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <button
              onClick={expandAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
            >
              Expand All
            </button>
            <span className="text-border">|</span>
            <button
              onClick={collapseAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
            >
              Collapse All
            </button>
          </div>
        </div>

        {/* Deliverable Cards */}
        {filteredDeliverables.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-card/50 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-muted-foreground/30" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {isRunning ? "Results are being generated..." : "No deliverables yet"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isRunning
                ? "AI agents are working on your task. Results will appear here as they complete."
                : "This task has no deliverables in the selected category."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDeliverables.map(d => {
              const key = `${d.agentRole}_${d.phase}`;
              return (
                <DeliverableCard
                  key={key}
                  agentRole={d.agentRole}
                  content={d.content || ""}
                  durationMs={d.durationMs}
                  isExpanded={expandedCards.has(key)}
                  onToggle={() => toggleCard(key)}
                />
              );
            })}
          </div>
        )}

        {/* Bottom Export Section */}
        {isCompleted && deliverables.length > 0 && (
          <div className="mt-8 p-6 rounded-xl border border-border/30 bg-card/20 text-center">
            <h3 className="text-sm font-semibold mb-2">Export Complete Report</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Download all {deliverables.length} agent deliverables as a single Markdown document
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  const md = buildFullExport(
                    task.prompt,
                    deliverables.map(d => ({
                      agentRole: d.agentRole,
                      content: d.content || "",
                      durationMs: d.durationMs,
                    })),
                  );
                  downloadMarkdown(md, `prism-report-${task.id}.md`);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-prism-cyan text-prism-navy font-semibold rounded-lg hover:bg-prism-cyan/90 transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                Download Markdown Report
              </button>
              <CopyButton
                text={buildFullExport(
                  task.prompt,
                  deliverables.map(d => ({
                    agentRole: d.agentRole,
                    content: d.content || "",
                    durationMs: d.durationMs,
                  })),
                )}
                label="Copy All"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
