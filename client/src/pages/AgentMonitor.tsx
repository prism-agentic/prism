import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useState, useMemo, useEffect } from "react";
import { Link, useParams } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  Loader2,
  Bot,
  Zap,
  Search,
  FileText,
  Palette,
  Settings,
  Code2,
  Rocket,
  Shield,
  BarChart3,
  Timer,
  Activity,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ClipboardCheck,
} from "lucide-react";

// ─── Agent Definitions ─────────────────────────────────────────────
interface AgentDef {
  name: string;
  role: string;
  icon: React.ReactNode;
  color: string;
  department: string;
  phase: number[];
  isGate?: boolean;
}

const AGENTS: AgentDef[] = [
  { name: "指挥官", role: "conductor", icon: <Zap className="w-4 h-4" />, color: "#00d4ff", department: "专业", phase: [0] },
  { name: "调研员", role: "researcher", icon: <Search className="w-4 h-4" />, color: "#00d4ff", department: "专业", phase: [0] },
  { name: "产品经理", role: "pm", icon: <FileText className="w-4 h-4" />, color: "#f59e0b", department: "业务", phase: [1] },
  { name: "UX 设计师", role: "ux", icon: <Palette className="w-4 h-4" />, color: "#f59e0b", department: "设计", phase: [1] },
  { name: "后端架构师", role: "backend", icon: <Settings className="w-4 h-4" />, color: "#10b981", department: "工程", phase: [2, 3] },
  { name: "前端开发", role: "frontend", icon: <Code2 className="w-4 h-4" />, color: "#10b981", department: "工程", phase: [2, 3] },
  { name: "DevOps 工程师", role: "devops", icon: <Rocket className="w-4 h-4" />, color: "#10b981", department: "工程", phase: [3] },
  { name: "质量评审", role: "critic", icon: <Shield className="w-4 h-4" />, color: "#a855f7", department: "专业", phase: [4] },
  { name: "增长专家", role: "growth", icon: <BarChart3 className="w-4 h-4" />, color: "#a855f7", department: "业务", phase: [5] },
];

// Quality Gate 定义 — 作为特殊节点显示在对应阶段之后
interface GateDef {
  id: string;
  name: string;
  afterPhase: number;
  color: string;
}

const GATES: GateDef[] = [
  { id: "post_strategy", name: "策略门控", afterPhase: 1, color: "#eab308" },
  { id: "post_build", name: "构建门控", afterPhase: 3, color: "#eab308" },
  { id: "final", name: "最终验证", afterPhase: 4, color: "#eab308" },
];

const PHASE_NAMES = ["探索", "策略", "搭建", "构建", "加固", "发布"];
const PHASE_COLORS = ["#00d4ff", "#f59e0b", "#10b981", "#10b981", "#a855f7", "#a855f7"];

// ─── Agent Node Component ──────────────────────────────────────────
function AgentNode({
  agent,
  status,
  durationMs,
  isActive,
  onClick,
}: {
  agent: AgentDef;
  status: "idle" | "thinking" | "working" | "done" | "error";
  durationMs: number | null;
  isActive: boolean;
  onClick: () => void;
}) {
  const statusStyles: Record<string, string> = {
    idle: "border-border/50 bg-card/30",
    thinking: "border-prism-cyan/50 bg-prism-cyan/5 animate-pulse",
    working: "border-prism-amber/50 bg-prism-amber/5",
    done: "border-emerald-500/50 bg-emerald-500/5",
    error: "border-red-500/50 bg-red-500/5",
  };

  const statusIcons: Record<string, React.ReactNode> = {
    idle: <Clock className="w-3 h-3 text-muted-foreground" />,
    thinking: <Loader2 className="w-3 h-3 text-prism-cyan animate-spin" />,
    working: <Activity className="w-3 h-3 text-prism-amber animate-pulse" />,
    done: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
    error: <Shield className="w-3 h-3 text-red-400" />,
  };

  return (
    <button
      onClick={onClick}
      className={`relative p-3 rounded-xl border-2 transition-all hover:scale-105 ${statusStyles[status]} ${
        isActive ? "ring-2 ring-prism-cyan/30 scale-105" : ""
      }`}
    >
      {/* Status indicator dot */}
      <div className="absolute -top-1 -right-1">
        {statusIcons[status]}
      </div>

      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center mx-auto mb-2"
        style={{ backgroundColor: `${agent.color}15`, border: `1px solid ${agent.color}30`, color: agent.color }}
      >
        {agent.icon}
      </div>
      <p className="text-xs font-semibold text-center truncate" style={{ color: agent.color }}>
        {agent.name}
      </p>
      <p className="text-[10px] text-muted-foreground text-center">{agent.department}</p>
      {durationMs && (
        <p className="text-[10px] text-muted-foreground/60 text-center font-mono mt-1">
          {(durationMs / 1000).toFixed(1)}s
        </p>
      )}
    </button>
  );
}

// ─── Quality Gate Node Component ──────────────────────────────────
interface GateStatus {
  status: "idle" | "checking" | "pass" | "degraded" | "fail";
  score: number | null;
  content: string | null;
  action: string | null;
}

function GateNode({
  gate,
  gateStatus,
  isActive,
  onClick,
}: {
  gate: GateDef;
  gateStatus: GateStatus;
  isActive: boolean;
  onClick: () => void;
}) {
  const statusStyles: Record<string, string> = {
    idle: "border-border/30 bg-card/10 border-dashed",
    checking: "border-yellow-500/50 bg-yellow-500/5 animate-pulse",
    pass: "border-emerald-500/50 bg-emerald-500/5",
    degraded: "border-yellow-500/50 bg-yellow-500/5",
    fail: "border-red-500/50 bg-red-500/5",
  };

  const statusIcons: Record<string, React.ReactNode> = {
    idle: <ClipboardCheck className="w-4 h-4 text-muted-foreground/40" />,
    checking: <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />,
    pass: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
    degraded: <ShieldAlert className="w-4 h-4 text-yellow-400" />,
    fail: <ShieldX className="w-4 h-4 text-red-400" />,
  };

  const statusLabels: Record<string, string> = {
    idle: "等待中",
    checking: "验证中...",
    pass: "通过",
    degraded: "降级通过",
    fail: "未通过",
  };

  return (
    <button
      onClick={onClick}
      className={`relative p-3 rounded-xl border-2 transition-all hover:scale-105 w-full ${statusStyles[gateStatus.status]} ${
        isActive ? "ring-2 ring-yellow-500/30 scale-105" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${gate.color}10`, border: `1px solid ${gate.color}25` }}
        >
          {statusIcons[gateStatus.status]}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-xs font-semibold" style={{ color: gate.color }}>
            {gate.name}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {statusLabels[gateStatus.status]}
          </p>
        </div>
        {gateStatus.score !== null && (
          <div className="text-right shrink-0">
            <p className={`text-sm font-bold font-mono ${
              gateStatus.status === "pass" ? "text-emerald-400" :
              gateStatus.status === "degraded" ? "text-yellow-400" :
              gateStatus.status === "fail" ? "text-red-400" :
              "text-muted-foreground"
            }`}>
              {gateStatus.score}
            </p>
            <p className="text-[10px] text-muted-foreground/60">/100</p>
          </div>
        )}
      </div>
    </button>
  );
}

// ─── Pipeline Phase Bar ────────────────────────────────────────────
function PipelinePhaseBar({ currentPhase, status }: { currentPhase: number; status: string }) {
  return (
    <div className="flex items-center gap-1 w-full">
      {PHASE_NAMES.map((name, i) => {
        const isActive = i === currentPhase && status === "running";
        const isDone = i < currentPhase || status === "completed";
        const phaseColor = PHASE_COLORS[i];

        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className={`w-full h-2 rounded-full transition-all ${
                isActive
                  ? "animate-pulse"
                  : isDone
                  ? ""
                  : "bg-border/30"
              }`}
              style={{
                backgroundColor: isDone ? phaseColor : isActive ? `${phaseColor}80` : undefined,
              }}
            />
            <span className={`text-[10px] font-mono ${isDone ? "text-foreground/70" : isActive ? "text-prism-cyan" : "text-muted-foreground/40"}`}>
              {name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Gate Detail Panel ────────────────────────────────────────────
function GateDetailPanel({ gate, gateStatus }: { gate: GateDef; gateStatus: GateStatus }) {
  // Parse gate content for structured display
  const parsedResults = useMemo(() => {
    if (!gateStatus.content) return [];
    // Extract lines that look like criterion results: ✅/❌/⚠️/➖ **AC-xxx**: ...
    const lines = gateStatus.content.split("\n");
    const results: Array<{ icon: string; id: string; text: string; suggestion?: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^(✅|❌|⚠️|➖)\s+\*\*(.+?)\*\*:\s*(.+)/);
      if (match) {
        const result: { icon: string; id: string; text: string; suggestion?: string } = {
          icon: match[1],
          id: match[2],
          text: match[3],
        };
        // Check next line for fix suggestion
        if (i + 1 < lines.length && lines[i + 1].includes("💡")) {
          result.suggestion = lines[i + 1].replace(/.*💡\s*修复建议:\s*/, "");
        }
        results.push(result);
      }
    }
    return results;
  }, [gateStatus.content]);

  const statusColors: Record<string, string> = {
    pass: "text-emerald-400",
    degraded: "text-yellow-400",
    fail: "text-red-400",
    checking: "text-yellow-400",
    idle: "text-muted-foreground",
  };

  const statusLabels: Record<string, string> = {
    idle: "等待中",
    checking: "验证中...",
    pass: "✅ 通过",
    degraded: "⚠️ 降级通过",
    fail: "❌ 未通过",
  };

  return (
    <div className="rounded-xl border border-border/30 bg-card/20 p-4 sticky top-20">
      {/* Gate Header */}
      <div className="flex items-center gap-3 mb-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${gate.color}10`, border: `1px solid ${gate.color}25` }}
        >
          {gateStatus.status === "pass" ? (
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          ) : gateStatus.status === "fail" ? (
            <ShieldX className="w-6 h-6 text-red-400" />
          ) : gateStatus.status === "degraded" ? (
            <ShieldAlert className="w-6 h-6 text-yellow-400" />
          ) : gateStatus.status === "checking" ? (
            <Loader2 className="w-6 h-6 text-yellow-400 animate-spin" />
          ) : (
            <ClipboardCheck className="w-6 h-6 text-muted-foreground/40" />
          )}
        </div>
        <div>
          <p className="font-semibold" style={{ color: gate.color }}>
            {gate.name}
          </p>
          <p className={`text-xs ${statusColors[gateStatus.status]}`}>
            {statusLabels[gateStatus.status]}
          </p>
        </div>
      </div>

      {/* Score */}
      {gateStatus.score !== null && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">质量评分</span>
            <span className={`text-lg font-bold font-mono ${statusColors[gateStatus.status]}`}>
              {gateStatus.score}/100
            </span>
          </div>
          <Progress
            value={gateStatus.score}
            className="h-2"
          />
        </div>
      )}

      {/* Action */}
      {gateStatus.action && (
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-muted-foreground">操作</span>
          <span className="text-xs font-mono text-foreground/70">{gateStatus.action}</span>
        </div>
      )}

      {/* Criterion Results */}
      {parsedResults.length > 0 && (
        <div className="border-t border-border/30 pt-3">
          <span className="text-xs text-muted-foreground mb-2 block">验收标准验证结果</span>
          <div className="space-y-2 max-h-[350px] overflow-y-auto">
            {parsedResults.map((r, i) => (
              <div key={i} className="rounded-lg bg-background/50 border border-border/20 p-2.5">
                <div className="flex items-start gap-2">
                  <span className="text-sm shrink-0">{r.icon}</span>
                  <div className="min-w-0">
                    <span className="text-[11px] font-mono text-muted-foreground">{r.id}</span>
                    <p className="text-xs text-foreground/80 mt-0.5">{r.text}</p>
                    {r.suggestion && (
                      <p className="text-[10px] text-prism-cyan/70 mt-1">💡 {r.suggestion}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Raw Content Fallback */}
      {parsedResults.length === 0 && gateStatus.content && (
        <div className="border-t border-border/30 pt-3">
          <span className="text-xs text-muted-foreground mb-2 block">验证详情</span>
          <div className="rounded-lg bg-background/50 border border-border/20 p-3 max-h-[300px] overflow-y-auto text-xs text-foreground/70 font-mono whitespace-pre-wrap">
            {gateStatus.content.substring(0, 800)}
            {gateStatus.content.length > 800 && "..."}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────
export default function AgentMonitor() {
  const params = useParams<{ taskId: string }>();
  const taskId = parseInt(params.taskId || "0");
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [selectedGate, setSelectedGate] = useState<string | null>(null);

  const taskQuery = trpc.task.get.useQuery({ id: taskId }, { enabled: isAuthenticated && taskId > 0 });
  const logsQuery = trpc.task.logs.useQuery(
    { taskId },
    {
      enabled: isAuthenticated && taskId > 0,
      refetchInterval: 2000,
    },
  );

  const task = taskQuery.data as {
    id: number;
    prompt: string;
    status: string;
    currentPhase: number | null;
    totalPhases: number | null;
    projectId: number;
    startedAt: Date | null;
    completedAt: Date | null;
  } | undefined;

  // Derive agent statuses from logs
  const agentStatuses = useMemo(() => {
    const statuses: Record<string, { status: "idle" | "thinking" | "working" | "done" | "error"; durationMs: number | null; content: string | null; action: string | null }> = {};
    for (const agent of AGENTS) {
      statuses[agent.role] = { status: "idle", durationMs: null, content: null, action: null };
    }
    if (!logsQuery.data) return statuses;

    const logs = logsQuery.data as Array<{
      agentRole: string;
      status: string;
      durationMs: number | null;
      content: string | null;
      action: string | null;
    }>;

    for (const log of logs) {
      if (log.agentRole === "gate") continue; // Gate logs handled separately
      const current = statuses[log.agentRole];
      if (!current) continue;

      // Keep the latest status for each agent
      const statusPriority: Record<string, number> = { idle: 0, thinking: 1, working: 2, reviewing: 2, done: 3, error: 3 };
      const logStatus = log.status === "reviewing" ? "working" : log.status;
      if ((statusPriority[logStatus] ?? 0) >= (statusPriority[current.status] ?? 0)) {
        current.status = logStatus as any;
        if (log.durationMs) current.durationMs = log.durationMs;
        if (log.content && (log.status === "done" || log.status === "error")) current.content = log.content;
        if (log.action) current.action = log.action;
      }
    }

    return statuses;
  }, [logsQuery.data]);

  // Derive gate statuses from logs
  const gateStatuses = useMemo(() => {
    const statuses: Record<string, GateStatus> = {};
    for (const gate of GATES) {
      statuses[gate.id] = { status: "idle", score: null, content: null, action: null };
    }
    if (!logsQuery.data) return statuses;

    const logs = logsQuery.data as Array<{
      agentRole: string;
      status: string;
      content: string | null;
      action: string | null;
    }>;

    // Process gate logs
    for (const log of logs) {
      if (log.agentRole !== "gate") continue;

      // Match gate log to a specific gate by action content
      for (const gate of GATES) {
        const gateLabel = gate.id === "post_strategy" ? "策略阶段质量门控" :
                          gate.id === "post_build" ? "构建阶段质量门控" :
                          "最终质量验证";

        if (log.action && log.action.includes(gateLabel.substring(0, 4))) {
          const gs = statuses[gate.id];

          // Determine gate status from log
          if (log.status === "thinking") {
            if (gs.status === "idle") gs.status = "checking";
          } else if (log.status === "working") {
            gs.status = "checking";
          } else if (log.status === "done") {
            // Check if content indicates pass or degraded
            if (log.content?.includes("✅") && log.content?.includes("通过")) {
              gs.status = "pass";
            } else if (log.content?.includes("降级")) {
              gs.status = "degraded";
            } else {
              gs.status = "pass";
            }
          } else if (log.status === "error" || log.status === "reviewing") {
            if (log.content?.includes("❌") || log.content?.includes("未通过")) {
              gs.status = "fail";
            } else if (log.content?.includes("降级")) {
              gs.status = "degraded";
            } else if (log.content?.includes("跳过") || log.content?.includes("出错")) {
              gs.status = "fail";
            } else {
              gs.status = "checking";
            }
          }

          // Extract score from content
          if (log.content) {
            const scoreMatch = log.content.match(/评分:\s*(\d+)\/100/);
            if (scoreMatch) {
              gs.score = parseInt(scoreMatch[1]);
            }
          }

          // Keep latest content and action
          gs.content = log.content;
          gs.action = log.action;
        }
      }
    }

    return statuses;
  }, [logsQuery.data]);

  // Stats
  const completedAgents = Object.values(agentStatuses).filter(s => s.status === "done").length;
  const totalDuration = Object.values(agentStatuses).reduce((sum, s) => sum + (s.durationMs || 0), 0);
  const gatesCompleted = Object.values(gateStatuses).filter(s => s.status !== "idle" && s.status !== "checking").length;

  // Refetch task while running
  useEffect(() => {
    if (task?.status !== "running" && task?.status !== "pending") return;
    const interval = setInterval(() => taskQuery.refetch(), 3000);
    return () => clearInterval(interval);
  }, [task?.status]);

  // Auth redirect
  if (!authLoading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (authLoading || taskQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-prism-cyan/30 border-t-prism-cyan rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground font-mono">加载中...</span>
        </div>
      </div>
    );
  }

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

  const isRunning = task.status === "running";
  const isCompleted = task.status === "completed";
  const selectedAgentData = selectedAgent ? agentStatuses[selectedAgent] : null;
  const selectedAgentDef = selectedAgent ? AGENTS.find(a => a.role === selectedAgent) : null;
  const selectedGateDef = selectedGate ? GATES.find(g => g.id === selectedGate) : null;
  const selectedGateData = selectedGate ? gateStatuses[selectedGate] : null;

  // Clear the other selection when one is selected
  const handleAgentClick = (role: string) => {
    setSelectedGate(null);
    setSelectedAgent(selectedAgent === role ? null : role);
  };

  const handleGateClick = (gateId: string) => {
    setSelectedAgent(null);
    setSelectedGate(selectedGate === gateId ? null : gateId);
  };

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
            <span className="font-display font-semibold text-sm flex items-center gap-2">
              智能体监控
              {isRunning && (
                <span className="flex items-center gap-1 text-xs text-prism-cyan font-normal">
                  <span className="w-1.5 h-1.5 rounded-full bg-prism-cyan animate-pulse" />
                  实时
                </span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/results/${task.id}`}
              className="text-xs text-muted-foreground hover:text-prism-cyan transition-colors flex items-center gap-1"
            >
              查看结果 <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Task Info + Pipeline Progress */}
        <div className="glass-card rounded-xl p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate">{task.prompt}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {completedAgents}/{AGENTS.length} 个智能体已完成
                {gatesCompleted > 0 && ` | ${gatesCompleted}/3 个门控已验证`}
                {totalDuration > 0 && ` | 总耗时: ${(totalDuration / 1000).toFixed(0)}秒`}
              </p>
            </div>
            <Badge
              variant="outline"
              className={
                isCompleted
                  ? "border-emerald-500/30 text-emerald-400"
                  : isRunning
                  ? "border-prism-cyan/30 text-prism-cyan"
                  : "border-border text-muted-foreground"
              }
            >
              {isRunning && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              {isCompleted && <CheckCircle2 className="w-3 h-3 mr-1" />}
              {task.status}
            </Badge>
          </div>
          <PipelinePhaseBar currentPhase={task.currentPhase || 0} status={task.status} />
        </div>

        {/* Agent Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: 智能体网络 Grid */}
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              智能体网络 & 质量门控
            </h3>

            {/* Phase-grouped agent grid with gates */}
            <div className="space-y-4">
              {PHASE_NAMES.map((phaseName, phaseIdx) => {
                const phaseAgents = AGENTS.filter(a => a.phase.includes(phaseIdx));
                if (phaseAgents.length === 0) return null;

                const phaseColor = PHASE_COLORS[phaseIdx];
                const allDone = phaseAgents.every(a => agentStatuses[a.role]?.status === "done");
                const anyActive = phaseAgents.some(a => ["thinking", "working"].includes(agentStatuses[a.role]?.status));

                // Find gate after this phase
                const gateAfter = GATES.find(g => g.afterPhase === phaseIdx);
                const gateData = gateAfter ? gateStatuses[gateAfter.id] : null;

                return (
                  <div key={phaseIdx}>
                    {/* Phase block */}
                    <div className="rounded-xl border border-border/30 bg-card/20 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold"
                          style={{
                            backgroundColor: `${phaseColor}15`,
                            border: `1px solid ${phaseColor}30`,
                            color: phaseColor,
                          }}
                        >
                          {phaseIdx}
                        </div>
                        <span className="text-sm font-semibold" style={{ color: phaseColor }}>
                          {phaseName}
                        </span>
                        {allDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                        {anyActive && <Loader2 className="w-3.5 h-3.5 text-prism-cyan animate-spin" />}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {phaseAgents.map(agent => (
                          <AgentNode
                            key={`${agent.role}-${phaseIdx}`}
                            agent={agent}
                            status={agentStatuses[agent.role]?.status || "idle"}
                            durationMs={agentStatuses[agent.role]?.durationMs || null}
                            isActive={selectedAgent === agent.role}
                            onClick={() => handleAgentClick(agent.role)}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Gate after this phase */}
                    {gateAfter && gateData && (
                      <div className="flex items-center gap-2 my-2 px-2">
                        {/* Connector line */}
                        <div className="flex-1 h-px bg-border/30" />
                        <div className="w-full max-w-md">
                          <GateNode
                            gate={gateAfter}
                            gateStatus={gateData}
                            isActive={selectedGate === gateAfter.id}
                            onClick={() => handleGateClick(gateAfter.id)}
                          />
                        </div>
                        <div className="flex-1 h-px bg-border/30" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Detail Panel */}
          <div className="lg:col-span-1">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {selectedGate ? "门控详情" : "智能体详情"}
            </h3>

            {/* Gate Detail */}
            {selectedGate && selectedGateDef && selectedGateData ? (
              <GateDetailPanel gate={selectedGateDef} gateStatus={selectedGateData} />
            ) : selectedAgent && selectedAgentDef && selectedAgentData ? (
              /* Agent Detail */
              <div className="rounded-xl border border-border/30 bg-card/20 p-4 sticky top-20">
                {/* Agent Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{
                      backgroundColor: `${selectedAgentDef.color}15`,
                      border: `1px solid ${selectedAgentDef.color}30`,
                      color: selectedAgentDef.color,
                    }}
                  >
                    {selectedAgentDef.icon}
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: selectedAgentDef.color }}>
                      {selectedAgentDef.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{selectedAgentDef.department}</p>
                  </div>
                </div>

                {/* Status */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">状态</span>
                    <Badge
                      variant="outline"
                      className={
                        selectedAgentData.status === "done"
                          ? "border-emerald-500/30 text-emerald-400"
                          : selectedAgentData.status === "working" || selectedAgentData.status === "thinking"
                          ? "border-prism-cyan/30 text-prism-cyan"
                          : "border-border text-muted-foreground"
                      }
                    >
                      {selectedAgentData.status}
                    </Badge>
                  </div>
                  {selectedAgentData.action && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">操作</span>
                      <span className="text-xs font-mono text-foreground/70">{selectedAgentData.action}</span>
                    </div>
                  )}
                  {selectedAgentData.durationMs && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">耗时</span>
                      <span className="text-xs font-mono text-foreground/70 flex items-center gap-1">
                        <Timer className="w-3 h-3" />
                        {(selectedAgentData.durationMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">流水线阶段</span>
                    <span className="text-xs font-mono text-foreground/70">
                      {selectedAgentDef.phase.map(p => PHASE_NAMES[p]).join(", ")}
                    </span>
                  </div>
                </div>

                {/* Content Preview */}
                {selectedAgentData.content && (
                  <div className="border-t border-border/30 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">输出预览</span>
                      <Link
                        href={`/results/${taskId}`}
                        className="text-[10px] text-prism-cyan hover:underline flex items-center gap-1"
                      >
                        完整查看 <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                    </div>
                    <div className="rounded-lg bg-background/50 border border-border/20 p-3 max-h-[300px] overflow-y-auto text-xs text-foreground/70 font-mono whitespace-pre-wrap">
                      {selectedAgentData.content.substring(0, 500)}
                      {selectedAgentData.content.length > 500 && "..."}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-border/30 bg-card/20 p-8 text-center">
                <Bot className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  点击智能体或门控查看详情
                </p>
              </div>
            )}

            {/* Timeline */}
            <div className="mt-4 rounded-xl border border-border/30 bg-card/20 p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                执行时间线
              </h4>
              <div className="space-y-2">
                {AGENTS.map(agent => {
                  const s = agentStatuses[agent.role];
                  const pct = s?.durationMs ? Math.min((s.durationMs / 30000) * 100, 100) : 0;
                  return (
                    <div key={agent.role} className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground w-16 truncate">
                        {agent.name.split(" ")[0]}
                      </span>
                      <div className="flex-1 h-2 rounded-full bg-border/20 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor:
                              s?.status === "done"
                                ? agent.color
                                : s?.status === "working" || s?.status === "thinking"
                                ? `${agent.color}80`
                                : "transparent",
                          }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-muted-foreground/60 w-8 text-right">
                        {s?.durationMs ? `${(s.durationMs / 1000).toFixed(0)}s` : "-"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Gate Summary */}
              {gatesCompleted > 0 && (
                <div className="border-t border-border/30 mt-3 pt-3">
                  <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    质量门控
                  </h4>
                  <div className="space-y-1.5">
                    {GATES.map(gate => {
                      const gs = gateStatuses[gate.id];
                      const icon = gs.status === "pass" ? "✅" :
                                   gs.status === "degraded" ? "⚠️" :
                                   gs.status === "fail" ? "❌" :
                                   gs.status === "checking" ? "🔄" : "⏳";
                      return (
                        <div key={gate.id} className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {icon} {gate.name}
                          </span>
                          {gs.score !== null && (
                            <span className={`text-[10px] font-mono font-bold ${
                              gs.status === "pass" ? "text-emerald-400" :
                              gs.status === "degraded" ? "text-yellow-400" :
                              gs.status === "fail" ? "text-red-400" :
                              "text-muted-foreground"
                            }`}>
                              {gs.score}/100
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
