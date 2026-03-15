import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useState, useMemo, useEffect, useRef } from "react";
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
} from "lucide-react";

// ─── Agent Definitions ─────────────────────────────────────────────
interface AgentDef {
  name: string;
  role: string;
  icon: React.ReactNode;
  color: string;
  department: string;
  phase: number[];
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

// ─── Connection Lines (SVG) ────────────────────────────────────────
function ConnectionLines({
  agentStatuses,
}: {
  agentStatuses: Record<string, "idle" | "thinking" | "working" | "done" | "error">;
}) {
  // Define connections between agents based on context passing
  const connections = [
    { from: "conductor", to: "researcher" },
    { from: "researcher", to: "pm" },
    { from: "conductor", to: "pm" },
    { from: "pm", to: "ux" },
    { from: "researcher", to: "backend" },
    { from: "pm", to: "backend" },
    { from: "ux", to: "backend" },
    { from: "ux", to: "frontend" },
    { from: "backend", to: "frontend" },
    { from: "backend", to: "devops" },
    { from: "conductor", to: "critic" },
    { from: "pm", to: "critic" },
    { from: "backend", to: "critic" },
    { from: "frontend", to: "critic" },
    { from: "pm", to: "growth" },
    { from: "critic", to: "growth" },
  ];

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" style={{ zIndex: 0 }}>
      {connections.map((conn, i) => {
        const fromDone = agentStatuses[conn.from] === "done";
        const toDone = agentStatuses[conn.to] === "done";
        const isActive = fromDone && !toDone && agentStatuses[conn.to] !== "idle";

        // Simple visual connections — positions are approximate
        return (
          <line
            key={i}
            x1="50%"
            y1="50%"
            x2="50%"
            y2="50%"
            stroke={isActive ? "#00d4ff" : fromDone && toDone ? "#10b981" : "#333"}
            strokeWidth={isActive ? 2 : 1}
            strokeDasharray={isActive ? "4 4" : "none"}
            className={isActive ? "animate-pulse" : ""}
          />
        );
      })}
    </svg>
  );
}

// ─── Main Page Component ───────────────────────────────────────────
export default function AgentMonitor() {
  const params = useParams<{ taskId: string }>();
  const taskId = parseInt(params.taskId || "0");
  const { loading: authLoading, isAuthenticated } = useAuth();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

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
      const current = statuses[log.agentRole];
      if (!current) continue;

      // Keep the latest status for each agent
      const statusPriority: Record<string, number> = { idle: 0, thinking: 1, working: 2, reviewing: 2, done: 3, error: 3 };
      const logStatus = log.status === "reviewing" ? "working" : log.status;
      if ((statusPriority[logStatus] ?? 0) >= (statusPriority[current.status] ?? 0)) {
        current.status = logStatus as any;
        if (log.durationMs) current.durationMs = log.durationMs;
        if (log.content && log.status === "done") current.content = log.content;
        if (log.action) current.action = log.action;
      }
    }

    return statuses;
  }, [logsQuery.data]);

  // Stats
  const completedAgents = Object.values(agentStatuses).filter(s => s.status === "done").length;
  const totalDuration = Object.values(agentStatuses).reduce((sum, s) => sum + (s.durationMs || 0), 0);

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
          <span className="text-sm text-muted-foreground font-mono">加载监控中...</span>
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
              智能体网络
            </h3>

            {/* Phase-grouped agent grid */}
            <div className="space-y-4">
              {PHASE_NAMES.map((phaseName, phaseIdx) => {
                const phaseAgents = AGENTS.filter(a => a.phase.includes(phaseIdx));
                if (phaseAgents.length === 0) return null;

                const phaseColor = PHASE_COLORS[phaseIdx];
                const allDone = phaseAgents.every(a => agentStatuses[a.role]?.status === "done");
                const anyActive = phaseAgents.some(a => ["thinking", "working"].includes(agentStatuses[a.role]?.status));

                return (
                  <div key={phaseIdx} className="rounded-xl border border-border/30 bg-card/20 p-4">
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
                          onClick={() => setSelectedAgent(selectedAgent === agent.role ? null : agent.role)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: 智能体详情 Panel */}
          <div className="lg:col-span-1">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              智能体详情
            </h3>

            {selectedAgent && selectedAgentDef && selectedAgentData ? (
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
                  点击智能体查看详情
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
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
