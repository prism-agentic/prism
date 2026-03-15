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
    name: "指挥官",
    icon: <Zap className="w-4 h-4" />,
    color: "#00d4ff",
    category: "planning",
    categoryLabel: "规划与探索",
    description: "任务分解与编排调度",
  },
  researcher: {
    name: "调研员",
    icon: <Search className="w-4 h-4" />,
    color: "#00d4ff",
    category: "planning",
    categoryLabel: "规划与探索",
    description: "技术调研与市场分析",
  },
  pm: {
    name: "产品经理",
    icon: <FileText className="w-4 h-4" />,
    color: "#f59e0b",
    category: "requirements",
    categoryLabel: "需求与设计",
    description: "用户故事、MVP 范围与成功指标",
  },
  ux: {
    name: "UX 设计师",
    icon: <Palette className="w-4 h-4" />,
    color: "#f59e0b",
    category: "requirements",
    categoryLabel: "需求与设计",
    description: "信息架构与视觉设计",
  },
  backend: {
    name: "后端架构师",
    icon: <Settings className="w-4 h-4" />,
    color: "#10b981",
    category: "technical",
    categoryLabel: "技术设计",
    description: "数据库设计、API 设计与架构",
  },
  frontend: {
    name: "前端开发",
    icon: <Code2 className="w-4 h-4" />,
    color: "#10b981",
    category: "technical",
    categoryLabel: "技术设计",
    description: "组件架构与 UI 实现",
  },
  devops: {
    name: "DevOps 工程师",
    icon: <Rocket className="w-4 h-4" />,
    color: "#10b981",
    category: "technical",
    categoryLabel: "技术设计",
    description: "CI/CD 流水线与基础设施",
  },
  critic: {
    name: "质量评审",
    icon: <Shield className="w-4 h-4" />,
    color: "#a855f7",
    category: "quality",
    categoryLabel: "质量与增长",
    description: "代码审查与安全评估",
  },
  growth: {
    name: "增长专家",
    icon: <BarChart3 className="w-4 h-4" />,
    color: "#a855f7",
    category: "quality",
    categoryLabel: "质量与增长",
    description: "发布策略与增长战术",
  },
};

const CATEGORIES = [
  { id: "all", label: "全部交付物", icon: <Bot className="w-4 h-4" /> },
  { id: "planning", label: "规划", icon: <Search className="w-4 h-4" /> },
  { id: "requirements", label: "需求", icon: <FileText className="w-4 h-4" /> },
  { id: "technical", label: "技术", icon: <Code2 className="w-4 h-4" /> },
  { id: "quality", label: "质量与增长", icon: <Shield className="w-4 h-4" /> },
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
      {copied ? "已复制" : label}
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
            {(content.length / 1000).toFixed(1)}k 字符
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
            <CopyButton text={content} label="复制 Markdown" />
            <button
              onClick={() => downloadMarkdown(content, `${meta.name.toLowerCase().replace(/\s+/g, "-")}-output.md`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-card hover:border-prism-cyan/30 transition-all"
            >
              <Download className="w-3 h-3" />
              下载 .md
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
  lines.push(`# PRISM 任务报告`);
  lines.push("");
  lines.push(`> **任务:** ${taskPrompt}`);
  lines.push(`> **生成方:** PRISM 多智能体框架`);
  lines.push(`> **日期:** ${new Date().toLocaleDateString()}`);
  lines.push(`> **参与智能体:** ${deliverables.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const d of deliverables) {
    const meta = AGENT_META[d.agentRole];
    const name = meta?.name ?? d.agentRole;
    const desc = meta?.description ?? "";
    lines.push(`## ${name}`);
    if (desc) lines.push(`*${desc}*`);
    if (d.durationMs) lines.push(`*处理时间: ${(d.durationMs / 1000).toFixed(1)}秒*`);
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
          <span className="text-sm text-muted-foreground font-mono">加载结果中...</span>
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
          <h2 className="text-lg font-semibold mb-2">任务未找到</h2>
          <Link href="/dashboard" className="text-prism-cyan hover:underline">返回控制台</Link>
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
              <span className="text-sm hidden sm:inline">工作区</span>
            </Link>
            <ChevronRight className="w-3 h-3 text-border" />
            <span className="font-display font-semibold text-sm">任务结果</span>
            {isRunning && (
              <span className="flex items-center gap-1 text-xs text-prism-cyan">
                <span className="w-1.5 h-1.5 rounded-full bg-prism-cyan animate-pulse" />
                进行中...
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
              <span className="hidden sm:inline">导出完整报告</span>
              <span className="sm:hidden">导出</span>
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
                  ? `由 ${deliverables.length} 个 AI 智能体通过 6 个流水线阶段完成`
                  : isRunning
                  ? "AI 智能体正在处理此任务..."
                  : "任务已排队等待处理"}
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 flex-shrink-0">
              <div className="text-center p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-lg font-bold text-prism-cyan">{deliverables.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">智能体</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-lg font-bold text-prism-amber">6</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">阶段</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-lg font-bold text-foreground">{(totalDuration / 1000).toFixed(0)}s</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">总时间</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-background/50 border border-border/30">
                <p className="text-lg font-bold text-foreground">{(totalChars / 1000).toFixed(1)}k</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">字符数</p>
              </div>
            </div>
          </div>

          {/* Pipeline Progress */}
          {isRunning && (
            <div className="mt-4 pt-4 border-t border-border/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">流水线进度</span>
                <span className="text-xs font-mono text-prism-cyan">
                  阶段 {(task.currentPhase || 0) + 1} / {task.totalPhases || 6}
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
              全部展开
            </button>
            <span className="text-border">|</span>
            <button
              onClick={collapseAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
            >
              全部收起
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
              {isRunning ? "结果生成中..." : "暂无交付物"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isRunning
                ? "AI 智能体正在处理你的任务。完成后结果将显示在此处。"
                : "所选分类中没有交付物。"}
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
            <h3 className="text-sm font-semibold mb-2">导出完整报告</h3>
            <p className="text-xs text-muted-foreground mb-4">
              将全部 {deliverables.length} 个智能体交付物导出为单个 Markdown 文档
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
                下载 Markdown 报告
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
                label="复制全部"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
