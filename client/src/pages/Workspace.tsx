import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Streamdown } from "streamdown";
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
  ChevronDown,
  Terminal,
  Copy,
  Check,
  ExternalLink,
  FileText,
  BarChart3,
  Eye,
  MessageSquare,
  Zap,
  Users,
  SkipForward,
  PlayCircle,
  ThumbsUp,
  ThumbsDown,
  Download,
  Rocket,
  Code2,
  Smartphone,
} from "lucide-react";

// ─── Agent Definitions ──────────────────────────────────────────────

const AGENTS: Record<string, { name: string; color: string; emoji: string }> = {
  conductor: { name: "Conductor", color: "#00d4ff", emoji: "\u{1F3AF}" },
  researcher: { name: "Researcher", color: "#a78bfa", emoji: "\u{1F50D}" },
  pm: { name: "Product Manager", color: "#f59e0b", emoji: "\u{1F4CB}" },
  ux: { name: "UX Designer", color: "#f59e0b", emoji: "\u{1F3A8}" },
  backend: { name: "Backend Architect", color: "#00d4ff", emoji: "\u2699\uFE0F" },
  frontend: { name: "Frontend Dev", color: "#00d4ff", emoji: "\u{1F4BB}" },
  devops: { name: "DevOps Engineer", color: "#00d4ff", emoji: "\u{1F680}" },
  critic: { name: "Quality Critic", color: "#00d4ff", emoji: "\u{1F50E}" },
  growth: { name: "Growth Hacker", color: "#f59e0b", emoji: "\u{1F4C8}" },
  user: { name: "You", color: "#4ade80", emoji: "\u{1F464}" },
};

const PHASE_NAMES = ["Discover", "Strategy", "Scaffold", "Build", "Harden", "Launch"];

const TEMPLATE_ICONS: Record<string, React.ReactNode> = {
  "saas-mvp": <Rocket className="w-6 h-6" />,
  "api-design": <Code2 className="w-6 h-6" />,
  "mobile-app": <Smartphone className="w-6 h-6" />,
};

// ─── Shared Components ──────────────────────────────────────────────

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
              {isDone ? "\u2713" : i}
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="p-1 rounded hover:bg-white/10 transition-colors"
      title="Copy content"
    >
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
    </button>
  );
}

// ─── Feedback Buttons Component ─────────────────────────────────────

function FeedbackButtons({
  messageId,
  currentRating,
}: {
  messageId: number;
  currentRating?: "satisfied" | "unsatisfied" | null;
}) {
  const feedbackMutation = trpc.task.feedback.useMutation();
  const [localRating, setLocalRating] = useState<"satisfied" | "unsatisfied" | null>(currentRating || null);

  useEffect(() => {
    setLocalRating(currentRating || null);
  }, [currentRating]);

  const handleFeedback = (rating: "satisfied" | "unsatisfied") => {
    const newRating = localRating === rating ? null : rating;
    setLocalRating(newRating);
    if (newRating) {
      feedbackMutation.mutate({ messageId, rating: newRating });
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleFeedback("satisfied")}
        className={`p-1 rounded transition-all ${
          localRating === "satisfied"
            ? "bg-emerald-500/20 text-emerald-400"
            : "hover:bg-white/10 text-muted-foreground/50 hover:text-emerald-400"
        }`}
        title="Satisfied"
      >
        <ThumbsUp className="w-3 h-3" />
      </button>
      <button
        onClick={() => handleFeedback("unsatisfied")}
        className={`p-1 rounded transition-all ${
          localRating === "unsatisfied"
            ? "bg-red-500/20 text-red-400"
            : "hover:bg-white/10 text-muted-foreground/50 hover:text-red-400"
        }`}
        title="Unsatisfied"
      >
        <ThumbsDown className="w-3 h-3" />
      </button>
    </div>
  );
}

// ─── Meeting Message Component ──────────────────────────────────────

function MeetingMessage({
  msg,
  feedbackRating,
}: {
  msg: { id: number; sender: string; round: number; content: string; messageType: string | null; createdAt: Date };
  feedbackRating?: "satisfied" | "unsatisfied" | null;
}) {
  const agent = AGENTS[msg.sender] || { name: msg.sender, color: "#888", emoji: "\u{1F916}" };
  const isUser = msg.sender === "user";
  const isBrief = msg.messageType === "brief";
  const [expanded, setExpanded] = useState(isBrief || msg.content.length < 500);

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center text-base shadow-lg"
          style={{
            background: `linear-gradient(135deg, ${agent.color}30, ${agent.color}10)`,
            border: `2px solid ${agent.color}50`,
          }}
        >
          {agent.emoji}
        </div>
      </div>

      {/* Message Bubble */}
      <div className={`flex-1 max-w-[85%] ${isUser ? "ml-auto" : ""}`}>
        {/* Sender label */}
        <div className={`flex items-center gap-2 mb-1 ${isUser ? "justify-end" : ""}`}>
          <span className="text-xs font-semibold" style={{ color: agent.color }}>{agent.name}</span>
          {msg.messageType && msg.messageType !== "reply" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 text-muted-foreground capitalize">
              {msg.messageType === "brief" ? "Requirements Brief" : msg.messageType}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/50">R{msg.round}</span>
        </div>

        {/* Content */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm ${
            isUser
              ? "bg-prism-cyan/15 border border-prism-cyan/30 text-foreground"
              : isBrief
              ? "bg-amber-500/10 border border-amber-500/30 text-foreground"
              : "bg-card/80 border border-border/50 text-foreground/90"
          }`}
        >
          {expanded ? (
            <div className="prose prose-invert prose-sm max-w-none
              prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-2
              prose-p:text-foreground/80 prose-p:leading-relaxed
              prose-li:text-foreground/80
              prose-code:text-prism-cyan prose-code:bg-prism-cyan/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
              prose-pre:bg-[#0a1628] prose-pre:border prose-pre:border-border/30 prose-pre:rounded-lg
              prose-strong:text-foreground
              prose-a:text-prism-cyan prose-a:no-underline hover:prose-a:underline
            ">
              <Streamdown>{msg.content}</Streamdown>
            </div>
          ) : (
            <div>
              <p className="text-foreground/80 line-clamp-4">{msg.content.substring(0, 300)}...</p>
              <button
                onClick={() => setExpanded(true)}
                className="text-xs text-prism-cyan hover:underline mt-2"
              >
                Show full message
              </button>
            </div>
          )}
        </div>

        {/* Copy button + Feedback buttons for agent messages */}
        {!isUser && (
          <div className="flex items-center gap-2 mt-1">
            <CopyButton text={msg.content} />
            <FeedbackButtons messageId={msg.id} currentRating={feedbackRating} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Agent Log Entry (Pipeline View) ────────────────────────────────

function AgentLogEntry({ log, isLatest }: { log: any; isLatest: boolean }) {
  const agent = AGENTS[log.agentRole] || { name: log.agentName, color: "#888", emoji: "\u{1F916}" };
  const [expanded, setExpanded] = useState(false);
  const isDone = log.status === "done";
  const hasLongContent = isDone && log.content && log.content.length > 200;
  const shouldAutoExpand = isLatest && (log.status === "working" || log.status === "done");

  const statusMap: Record<string, React.ReactNode> = {
    thinking: <Loader2 className="w-3.5 h-3.5 animate-spin text-prism-cyan" />,
    working: <Activity className="w-3.5 h-3.5 text-prism-amber animate-pulse" />,
    reviewing: <Bot className="w-3.5 h-3.5 text-purple-400" />,
    done: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
    error: <AlertCircle className="w-3.5 h-3.5 text-red-400" />,
  };
  const statusIcon = statusMap[log.status as string] || <Clock className="w-3.5 h-3.5 text-muted-foreground" />;
  const isExpanded = expanded || shouldAutoExpand;

  return (
    <div className="rounded-lg hover:bg-card/50 transition-colors group border border-transparent hover:border-border/30">
      <div
        className={`flex gap-3 py-2.5 px-3 ${hasLongContent ? "cursor-pointer" : ""}`}
        onClick={() => hasLongContent && setExpanded(!expanded)}
      >
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
            <span className="text-xs text-muted-foreground font-mono">{log.action}</span>
            <span className="ml-auto flex items-center gap-1">
              {log.durationMs && (
                <span className="text-[10px] text-muted-foreground/60 font-mono">{(log.durationMs / 1000).toFixed(1)}s</span>
              )}
              {hasLongContent && (
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              )}
              {isDone && log.content && <CopyButton text={log.content} />}
            </span>
          </div>
          {isDone && log.content && !isExpanded && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{log.content.substring(0, 150)}...</p>
          )}
          {log.status === "working" && log.content && (
            <p className="text-xs text-prism-amber/70 mt-1 flex items-center gap-1">
              <Activity className="w-3 h-3 animate-pulse" />
              {log.content}
            </p>
          )}
        </div>
      </div>
      {isDone && log.content && isExpanded && (
        <div className="px-3 pb-3 pl-[52px]">
          <div className="rounded-lg bg-background/50 border border-border/30 p-4 text-sm prose prose-invert prose-sm max-w-none
            prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-2
            prose-p:text-foreground/80 prose-p:leading-relaxed
            prose-li:text-foreground/80
            prose-code:text-prism-cyan prose-code:bg-prism-cyan/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
            prose-pre:bg-[#0a1628] prose-pre:border prose-pre:border-border/30 prose-pre:rounded-lg
            prose-strong:text-foreground
          ">
            <Streamdown>{log.content}</Streamdown>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Template Selector Component ────────────────────────────────────

function TemplateSelector({
  onSelect,
}: {
  onSelect: (prompt: string, templateId: string) => void;
}) {
  const templatesQuery = trpc.task.templates.useQuery();
  const templates = templatesQuery.data || [];

  if (templatesQuery.isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-xl border border-border/30 bg-card/30 p-4 animate-pulse">
            <div className="w-10 h-10 rounded-lg bg-border/30 mb-3" />
            <div className="h-4 w-24 bg-border/30 rounded mb-2" />
            <div className="h-3 w-full bg-border/20 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {templates.map(tpl => (
        <button
          key={tpl.id}
          onClick={() => onSelect(tpl.prompt, tpl.id)}
          className="text-left rounded-xl border border-border/40 bg-card/40 hover:bg-card/70 hover:border-prism-cyan/30 p-4 transition-all group"
        >
          <div className="w-10 h-10 rounded-lg bg-prism-cyan/10 border border-prism-cyan/20 flex items-center justify-center text-prism-cyan mb-3 group-hover:bg-prism-cyan/20 transition-colors">
            {TEMPLATE_ICONS[tpl.id] || <Sparkles className="w-5 h-5" />}
          </div>
          <h4 className="text-sm font-semibold mb-1 group-hover:text-prism-cyan transition-colors">
            {tpl.nameZh}
          </h4>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {tpl.descriptionZh}
          </p>
        </button>
      ))}
    </div>
  );
}

// ─── Meeting View Component ─────────────────────────────────────────

function MeetingView({
  taskId,
  task,
  onConfirm,
}: {
  taskId: number;
  task: any;
  onConfirm: () => void;
}) {
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const meetingQuery = trpc.task.meetingMessages.useQuery(
    { taskId },
    { refetchInterval: 2000 }
  );

  const feedbacksQuery = trpc.task.feedbacks.useQuery(
    { taskId },
    { enabled: (meetingQuery.data?.length ?? 0) > 0 }
  );

  const replyMutation = trpc.task.reply.useMutation({
    onSuccess: () => {
      setReplyText("");
      meetingQuery.refetch();
    },
  });

  const confirmMutation = trpc.task.confirmMeeting.useMutation({
    onSuccess: () => {
      onConfirm();
    },
  });

  const exportQuery = trpc.task.exportMeeting.useQuery(
    { taskId },
    { enabled: false }
  );

  const messages = meetingQuery.data || [];
  const feedbacks = feedbacksQuery.data || [];
  const agentMessages = messages.filter(m => m.sender !== "user");
  const isWaitingForAgents = agentMessages.length === 0 || replyMutation.isPending;
  const hasBrief = messages.some(m => m.messageType === "brief");
  const isProcessing = replyMutation.isPending || confirmMutation.isPending;

  // Build feedback lookup: messageId -> rating
  const feedbackMap = useMemo(() => {
    const map: Record<number, "satisfied" | "unsatisfied"> = {};
    for (const fb of feedbacks) {
      map[fb.messageId] = fb.rating as "satisfied" | "unsatisfied";
    }
    return map;
  }, [feedbacks]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleExport = async () => {
    const result = await exportQuery.refetch();
    if (result.data?.markdown) {
      const blob = new Blob([result.data.markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `prism-meeting-${taskId}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Meeting Header */}
      <div className="px-4 py-3 border-b border-border/50 bg-card/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-prism-amber/15 border border-prism-amber/30 flex items-center justify-center">
              <Users className="w-4 h-4 text-prism-amber" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Requirement Meeting</h3>
              <p className="text-xs text-muted-foreground">
                {messages.length === 0
                  ? "Agents are analyzing your task..."
                  : hasBrief
                  ? "Requirements Brief generated. Ready to execute."
                  : `Round ${task.meetingRound || 1} — ${agentMessages.length} agent messages`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Export button — show when there are messages */}
            {messages.length > 0 && (
              <button
                onClick={handleExport}
                disabled={exportQuery.isFetching}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all disabled:opacity-50"
                title="Export meeting transcript as Markdown"
              >
                {exportQuery.isFetching ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                <span className="hidden sm:inline">Export .md</span>
              </button>
            )}
            {!hasBrief && messages.length > 0 && (
              <button
                onClick={() => confirmMutation.mutate({ taskId })}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-all disabled:opacity-50"
              >
                {confirmMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <PlayCircle className="w-3 h-3" />
                )}
                Start Execution
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Meeting Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                {["conductor", "researcher", "pm"].map(role => {
                  const a = AGENTS[role];
                  return (
                    <div
                      key={role}
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg animate-pulse"
                      style={{
                        background: `linear-gradient(135deg, ${a.color}30, ${a.color}10)`,
                        border: `2px solid ${a.color}40`,
                        animationDelay: `${["conductor", "researcher", "pm"].indexOf(role) * 0.3}s`,
                      }}
                    >
                      {a.emoji}
                    </div>
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground">
                Conductor, Researcher, and PM are analyzing your task...
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                This usually takes 15-30 seconds
              </p>
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <MeetingMessage
                key={msg.id}
                msg={msg as any}
                feedbackRating={feedbackMap[msg.id] || null}
              />
            ))}
            {replyMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pl-12">
                <Loader2 className="w-4 h-4 animate-spin text-prism-cyan" />
                Agents are processing your reply...
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Reply Input — only show during clarifying, not after brief */}
      {!hasBrief && messages.length > 0 && (
        <div className="border-t border-border/50 p-4 bg-card/30">
          <div className="flex gap-3 max-w-4xl mx-auto">
            <div className="flex-1 relative">
              <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && replyText.trim() && !isProcessing) {
                    replyMutation.mutate({ taskId, message: replyText.trim() });
                  }
                }}
                placeholder="Reply to the meeting discussion..."
                className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-prism-cyan/50 text-sm"
                disabled={isProcessing}
              />
            </div>
            <button
              onClick={() => {
                if (replyText.trim() && !isProcessing) {
                  replyMutation.mutate({ taskId, message: replyText.trim() });
                }
              }}
              disabled={!replyText.trim() || isProcessing}
              className="px-4 py-3 bg-prism-cyan/15 border border-prism-cyan/30 text-prism-cyan font-medium rounded-xl hover:bg-prism-cyan/25 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {replyMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">Reply</span>
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground/50 text-center mt-2">
            Answer the questions above, or click "Start Execution" to proceed with the agents' best judgment.
          </p>
        </div>
      )}

      {/* After brief generated — show proceed button + export */}
      {hasBrief && task.status === "clarifying" && (
        <div className="border-t border-border/50 p-4 bg-emerald-500/5">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-400 font-medium">Requirements Brief ready</span>
              </div>
              <button
                onClick={handleExport}
                disabled={exportQuery.isFetching}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all disabled:opacity-50"
              >
                {exportQuery.isFetching ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                Export .md
              </button>
            </div>
            <button
              onClick={() => confirmMutation.mutate({ taskId })}
              disabled={confirmMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-prism-cyan text-prism-navy font-semibold rounded-xl hover:bg-prism-cyan/90 transition-colors disabled:opacity-50"
            >
              {confirmMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              Start Pipeline Execution
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Workspace Component ───────────────────────────────────────

export default function Workspace() {
  const params = useParams<{ id: string }>();
  const projectId = parseInt(params.id || "0");
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const [prompt, setPrompt] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<number | null>(null);
  const [skipMeeting, setSkipMeeting] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
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
      setSelectedTemplate(null);
      tasksQuery.refetch();
    },
  });

  // Auto-select latest running/clarifying task
  useEffect(() => {
    if (!activeTaskId && tasksQuery.data?.length) {
      const active = tasksQuery.data.find(t => t.status === "running" || t.status === "clarifying");
      setActiveTaskId(active?.id || tasksQuery.data[0].id);
    }
  }, [tasksQuery.data, activeTaskId]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logsQuery.data]);

  // Refetch tasks while any is active
  useEffect(() => {
    if (!tasksQuery.data?.some(t => ["running", "pending", "clarifying"].includes(t.status))) return;
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

  const logs: Array<any> = (logsQuery.data || []) as any;
  const tasks = tasksQuery.data || [];
  const latestDoneLogId = [...logs].reverse().find(l => l.status === "done")?.id;

  // Determine what view to show for the active task
  const isMeetingPhase = activeTask?.status === "clarifying" || (activeTask?.status === "pending" && !activeTask?.meetingRound);
  const isPipelinePhase = activeTask?.status === "running" || activeTask?.status === "completed" || activeTask?.status === "failed";

  const handleTemplateSelect = (templatePrompt: string, templateId: string) => {
    setPrompt(templatePrompt);
    setSelectedTemplate(templateId);
  };

  const handleSubmit = () => {
    if (prompt.trim() && !createTaskMutation.isPending) {
      createTaskMutation.mutate({
        projectId,
        prompt: prompt.trim(),
        skipMeeting,
        templateId: selectedTemplate || undefined,
      });
    }
  };

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
            {activeTask?.status === "clarifying" && (
              <span className="flex items-center gap-1 text-xs text-prism-amber">
                <MessageSquare className="w-3 h-3" />
                Requirement Meeting
              </span>
            )}
            {activeTask?.status === "running" && (
              <span className="flex items-center gap-1 text-xs text-prism-cyan">
                <span className="w-1.5 h-1.5 rounded-full bg-prism-cyan animate-pulse" />
                AI Agents Working...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeTaskId && (
              <>
                <Link
                  href={`/monitor/${activeTaskId}`}
                  className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-border hover:bg-card hover:border-prism-cyan/30 transition-all text-muted-foreground hover:text-prism-cyan"
                >
                  <BarChart3 className="w-3 h-3" />
                  Monitor
                </Link>
                {activeTask?.status === "completed" && (
                  <Link
                    href={`/results/${activeTaskId}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-prism-cyan/10 border border-prism-cyan/30 text-prism-cyan hover:bg-prism-cyan/20 transition-all"
                  >
                    <FileText className="w-3 h-3" />
                    <span className="hidden sm:inline">View Results</span>
                    <span className="sm:hidden">Results</span>
                  </Link>
                )}
              </>
            )}
            {activeTask && isPipelinePhase && (
              <PhaseIndicator
                currentPhase={activeTask.currentPhase || 0}
                totalPhases={activeTask.totalPhases || 6}
                status={activeTask.status}
              />
            )}
          </div>
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
                    ) : task.status === "clarifying" ? (
                      <MessageSquare className="w-3 h-3 text-prism-amber flex-shrink-0" />
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

        {/* Center: Main View Area */}
        <div className="flex-1 flex flex-col">
          {/* Meeting View */}
          {activeTaskId && isMeetingPhase && (
            <MeetingView
              taskId={activeTaskId}
              task={activeTask}
              onConfirm={() => tasksQuery.refetch()}
            />
          )}

          {/* Pipeline View */}
          {activeTaskId && isPipelinePhase && (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {logs.length > 0 ? (
                  <>
                    {logs.map((log: any, i: number) => {
                      const showPhaseHeader = i === 0 || log.phase !== logs[i - 1]?.phase;
                      return (
                        <div key={log.id}>
                          {showPhaseHeader && log.phase != null && (
                            <div className="flex items-center gap-2 py-3 mt-2 first:mt-0">
                              <div className="h-px flex-1 bg-border/50" />
                              <span className="text-xs font-mono text-prism-cyan/70 uppercase tracking-wider">
                                Phase {log.phase}: {PHASE_NAMES[log.phase] ?? ""}
                              </span>
                              <div className="h-px flex-1 bg-border/50" />
                            </div>
                          )}
                          <AgentLogEntry log={log} isLatest={log.id === latestDoneLogId} />
                        </div>
                      );
                    })}
                    <div ref={logsEndRef} />
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Loader2 className="w-8 h-8 animate-spin text-prism-cyan mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">Initializing agent pipeline...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Task Result */}
              {activeTask?.status === "completed" && activeTask.result != null && (
                <div className="mx-4 mb-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-semibold text-emerald-400">Pipeline Complete</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/monitor/${activeTaskId}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-border hover:bg-card hover:border-prism-cyan/30 transition-all text-muted-foreground hover:text-prism-cyan"
                      >
                        <BarChart3 className="w-3 h-3" />
                        Monitor
                      </Link>
                      <Link
                        href={`/results/${activeTaskId}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-prism-cyan text-prism-navy hover:bg-prism-cyan/90 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        View Full Results
                      </Link>
                    </div>
                  </div>
                  <p className="text-sm text-foreground/80">
                    {(() => {
                      const r = activeTask.result as Record<string, unknown> | null;
                      return String(r?.summary ?? "Task completed successfully.");
                    })()}
                  </p>
                </div>
              )}
            </>
          )}

          {/* Empty State — no active task, show template selector */}
          {!activeTaskId && (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center max-w-2xl w-full">
                <div className="w-16 h-16 rounded-2xl bg-prism-cyan/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-prism-cyan/50" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Ready to collaborate</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Choose a template to get started quickly, or describe your own task below.
                </p>

                {/* Template Cards */}
                <TemplateSelector onSelect={handleTemplateSelect} />

                {selectedTemplate && (
                  <div className="mt-4 p-3 rounded-lg bg-prism-cyan/5 border border-prism-cyan/20 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-prism-cyan" />
                      <span className="text-xs font-medium text-prism-cyan">Template selected</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      You can edit the prompt below before starting.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Input Bar — only show when not in meeting phase */}
          {(!activeTaskId || isPipelinePhase || (!isMeetingPhase && !isPipelinePhase)) && (
            <div className="border-t border-border/50 p-4 bg-card/30">
              <div className="flex gap-3 max-w-4xl mx-auto">
                <div className="flex-1 relative">
                  <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && prompt.trim() && !createTaskMutation.isPending) {
                        handleSubmit();
                      }
                    }}
                    placeholder="Describe your task... (e.g., Build a social e-commerce platform)"
                    className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-prism-cyan/50 text-sm"
                    disabled={createTaskMutation.isPending}
                  />
                </div>
                <button
                  onClick={handleSubmit}
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
              {/* Skip meeting toggle */}
              <div className="flex items-center justify-center gap-2 mt-2">
                <button
                  onClick={() => setSkipMeeting(!skipMeeting)}
                  className={`flex items-center gap-1.5 px-3 py-1 text-[11px] rounded-full transition-all ${
                    skipMeeting
                      ? "bg-prism-amber/15 border border-prism-amber/30 text-prism-amber"
                      : "bg-transparent border border-border/50 text-muted-foreground hover:border-border"
                  }`}
                >
                  {skipMeeting ? (
                    <Zap className="w-3 h-3" />
                  ) : (
                    <Users className="w-3 h-3" />
                  )}
                  {skipMeeting ? "Fast Mode (skip meeting)" : "Meeting Mode (recommended)"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
