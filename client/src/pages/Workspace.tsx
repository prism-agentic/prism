import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useState, useEffect, useRef } from "react";
import { Link, useParams, useLocation } from "wouter";
import {
  ArrowLeft,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Bot,
  Sparkles,
  Activity,
  ChevronRight,
  Play,
  Pause,
  Terminal,
} from "lucide-react";

// Agent definitions
const AGENTS: Record<string, { name: string; color: string; emoji: string }> = {
  conductor: { name: "Conductor", color: "#00d4ff", emoji: "🎯" },
  researcher: { name: "Researcher", color: "#00d4ff", emoji: "🔍" },
  pm: { name: "Product Manager", color: "#f59e0b", emoji: "📋" },
  ux: { name: "UX Designer", color: "#f59e0b", emoji: "🎨" },
  backend: { name: "Backend Architect", color: "#00d4ff", emoji: "⚙️" },
  frontend: { name: "Frontend Dev", color: "#00d4ff", emoji: "💻" },
  devops: { name: "DevOps Engineer", color: "#00d4ff", emoji: "🚀" },
  critic: { name: "Quality Critic", color: "#00d4ff", emoji: "🔎" },
  growth: { name: "Growth Hacker", color: "#f59e0b", emoji: "📈" },
};

const PHASE_NAMES = ["Discover", "Strategy", "Scaffold", "Build", "Harden", "Launch"];

function PhaseIndicator({ currentPhase, totalPhases, status }: { currentPhase: number; totalPhases: number; status: string }) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: totalPhases }, (_, i) => {
        const isActive = i === currentPhase && status === "running";
        const isDone = i < currentPhase || status === "completed";
        return (
          <div key={i} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-mono transition-all ${
                isActive
                  ? "bg-prism-cyan/20 border border-prism-cyan text-prism-cyan animate-pulse"
                  : isDone
                  ? "bg-emerald-500/20 border border-emerald-500/50 text-emerald-400"
                  : "bg-card border border-border text-muted-foreground"
              }`}
              title={PHASE_NAMES[i]}
            >
              {isDone ? "✓" : i}
            </div>
            {i < totalPhases - 1 && (
              <div className={`w-4 h-0.5 ${isDone ? "bg-emerald-500/50" : "bg-border"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function AgentLogEntry({ log }: { log: any }) {
  const agent = AGENTS[log.agentRole] || { name: log.agentName, color: "#888", emoji: "🤖" };
  const statusMap: Record<string, React.ReactNode> = {
    thinking: <Loader2 className="w-3.5 h-3.5 animate-spin text-prism-cyan" />,
    working: <Activity className="w-3.5 h-3.5 text-prism-amber animate-pulse" />,
    reviewing: <Bot className="w-3.5 h-3.5 text-purple-400" />,
    done: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
    error: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
  };
  const statusIcon = statusMap[log.status as string] || <Clock className="w-3.5 h-3.5 text-muted-foreground" />;

  return (
    <div className="flex gap-3 py-2.5 px-3 rounded-lg hover:bg-card/50 transition-colors group">
      <div className="flex-shrink-0 mt-0.5">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center text-sm"
          style={{ backgroundColor: `${agent.color}15`, border: `1px solid ${agent.color}30` }}
        >
          {agent.emoji}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: agent.color }}>{agent.name}</span>
          {statusIcon}
          <span className="text-xs text-muted-foreground ml-auto font-mono">
            P{log.phase}
          </span>
        </div>
        {log.action && (
          <p className="text-sm text-foreground/80 mt-0.5">{log.action}</p>
        )}
        {log.content && log.status !== "thinking" && (
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{log.content}</p>
        )}
        {log.durationMs && (
          <span className="text-[10px] text-muted-foreground/60 font-mono">{(log.durationMs / 1000).toFixed(1)}s</span>
        )}
      </div>
    </div>
  );
}

export default function Workspace() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || "0");
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [prompt, setPrompt] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const projectQuery = trpc.project.get.useQuery({ id: projectId }, { enabled: isAuthenticated && projectId > 0 });
  const tasksQuery = trpc.task.list.useQuery({ projectId }, { enabled: isAuthenticated && projectId > 0 });
  const logsQuery = trpc.task.logs.useQuery(
    { taskId: activeTaskId! },
    {
      enabled: !!activeTaskId,
      refetchInterval: 2000,
    }
  );
  const activeTask = tasksQuery.data?.find(t => t.id === activeTaskId);

  const createTaskMutation = trpc.task.create.useMutation({
    onSuccess: (data) => {
      setActiveTaskId(data.id);
      setPrompt("");
      tasksQuery.refetch();
    },
  });

  // Auto-select latest running task
  useEffect(() => {
    if (!activeTaskId && tasksQuery.data?.length) {
      const running = tasksQuery.data.find(t => t.status === "running");
      setActiveTaskId(running?.id || tasksQuery.data[0].id);
    }
  }, [tasksQuery.data, activeTaskId]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logsQuery.data]);

  // Refetch tasks while any is running
  useEffect(() => {
    if (!tasksQuery.data?.some(t => t.status === "running" || t.status === "pending")) return;
    const interval = setInterval(() => tasksQuery.refetch(), 3000);
    return () => clearInterval(interval);
  }, [tasksQuery.data]);

  if (!authLoading && !isAuthenticated) {
    window.location.href = getLoginUrl();
    return null;
  }

  if (authLoading || projectQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-prism-cyan/30 border-t-prism-cyan rounded-full animate-spin" />
          <span className="text-sm text-muted-foreground font-mono">Loading workspace...</span>
        </div>
      </div>
    );
  }

  const project = projectQuery.data;
  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Project not found</h2>
          <Link href="/dashboard" className="text-prism-cyan hover:underline">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const logs: Array<{ id: number; taskId: number; agentName: string; agentRole: string; phase: number | null; action: string | null; content: string | null; status: string; durationMs: number | null; createdAt: Date }> = (logsQuery.data || []) as any;
  const tasks = tasksQuery.data || [];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Bar */}
      <nav className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-full px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm hidden sm:inline">Dashboard</span>
            </Link>
            <ChevronRight className="w-3 h-3 text-border" />
            <span className="font-display font-semibold text-sm truncate max-w-[200px]">{project.name}</span>
            {project.status === "running" && (
              <span className="flex items-center gap-1 text-xs text-prism-cyan">
                <span className="w-1.5 h-1.5 rounded-full bg-prism-cyan animate-pulse" />
                Running
              </span>
            )}
          </div>
          {activeTask && (
            <PhaseIndicator
              currentPhase={activeTask.currentPhase || 0}
              totalPhases={activeTask.totalPhases || 6}
              status={activeTask.status}
            />
          )}
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left: Task History Sidebar */}
        <div className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r border-border/50 bg-card/30">
          <div className="p-3 border-b border-border/50">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tasks</h3>
          </div>
          <div className="p-2 space-y-1 max-h-[200px] lg:max-h-none overflow-y-auto flex lg:flex-col flex-row gap-1 lg:gap-0">
            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">No tasks yet. Start one below.</p>
            ) : (
              tasks.map(task => (
                <button
                  key={task.id}
                  onClick={() => setActiveTaskId(task.id)}
                  className={`w-full text-left p-2.5 rounded-lg text-sm transition-all whitespace-nowrap lg:whitespace-normal ${
                    activeTaskId === task.id
                      ? "bg-prism-cyan/10 border border-prism-cyan/30"
                      : "hover:bg-card border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {task.status === "running" ? (
                      <Loader2 className="w-3 h-3 animate-spin text-prism-cyan flex-shrink-0" />
                    ) : task.status === "completed" ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                    ) : task.status === "failed" ? (
                      <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
                    ) : (
                      <Clock className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="truncate text-xs">{task.prompt}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Center: Agent Activity Feed */}
        <div className="flex-1 flex flex-col">
          {/* Agent Logs */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {(activeTaskId !== null && logs.length > 0) ? (
              <>
                {/* Phase headers interleaved */}
                {logs.map((log, i) => {
                  const showPhaseHeader = i === 0 || log.phase !== logs[i - 1]?.phase;
                  return (
                    <div key={log.id}>
                      {showPhaseHeader && (
                        <div className="flex items-center gap-2 py-3 mt-2 first:mt-0">
                          <div className="h-px flex-1 bg-border/50" />
                          <span className="text-xs font-mono text-prism-cyan/70 uppercase tracking-widest">
                            Phase {log.phase}: {PHASE_NAMES[log.phase as number] || `Phase ${log.phase}`}
                          </span>
                          <div className="h-px flex-1 bg-border/50" />
                        </div>
                      )}
                      <AgentLogEntry log={log} />
                    </div>
                  );
                })}
                <div ref={logsEndRef} />
              </>
            ) : activeTaskId ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-prism-cyan mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Initializing agent pipeline...</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                  <div className="w-16 h-16 rounded-2xl bg-prism-cyan/10 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="w-8 h-8 text-prism-cyan/50" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Ready to collaborate</h3>
                  <p className="text-sm text-muted-foreground">
                    Describe your task below. 9 specialized AI agents will collaborate through a 6-phase pipeline to deliver results.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Task Result */}
          {activeTask?.status === "completed" && activeTask.result != null && (
            <div className="mx-4 mb-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">Task Completed</span>
              </div>
              <p className="text-sm text-foreground/80">
                {(() => {
                  const r = activeTask.result as Record<string, unknown> | null;
                  return String(r?.summary ?? "Task completed successfully.");
                })()}
              </p>
            </div>
          )}

          {/* Input Bar */}
          <div className="border-t border-border/50 p-4 bg-card/30">
            <div className="flex gap-3 max-w-4xl mx-auto">
              <div className="flex-1 relative">
                <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && prompt.trim() && !createTaskMutation.isPending) {
                      createTaskMutation.mutate({ projectId, prompt: prompt.trim() });
                    }
                  }}
                  placeholder="Describe your task... (e.g., Build a todo app with React and Node.js)"
                  className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-prism-cyan/50 text-sm"
                  disabled={createTaskMutation.isPending}
                />
              </div>
              <button
                onClick={() => {
                  if (prompt.trim() && !createTaskMutation.isPending) {
                    createTaskMutation.mutate({ projectId, prompt: prompt.trim() });
                  }
                }}
                disabled={!prompt.trim() || createTaskMutation.isPending}
                className="px-5 py-3 bg-prism-cyan text-prism-navy font-semibold rounded-xl hover:bg-prism-cyan/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {createTaskMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">Run</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
