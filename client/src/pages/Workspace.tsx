import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
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
  Edit3,
  RotateCcw,
  ShieldCheck,
  Save,
  X,
} from "lucide-react";
import ModelSelector from "@/components/ModelSelector";
import VerificationReportCard from "@/components/VerificationReportCard";
import { useTaskSSE, type SSEConnectionState } from "@/hooks/useTaskSSE";
import type { TaskEvent } from "../../../shared/taskEvents";

// ─── Agent Definitions ──────────────────────────────────────────────

const AGENTS: Record<string, { name: string; color: string; emoji: string }> = {
  conductor: { name: "指挥官", color: "#00d4ff", emoji: "\u{1F3AF}" },
  researcher: { name: "调研员", color: "#a78bfa", emoji: "\u{1F50D}" },
  pm: { name: "产品经理", color: "#f59e0b", emoji: "\u{1F4CB}" },
  ux: { name: "UX 设计师", color: "#f59e0b", emoji: "\u{1F3A8}" },
  backend: { name: "后端架构师", color: "#00d4ff", emoji: "\u2699\uFE0F" },
  frontend: { name: "前端开发", color: "#00d4ff", emoji: "\u{1F4BB}" },
  devops: { name: "DevOps 工程师", color: "#00d4ff", emoji: "\u{1F680}" },
  critic: { name: "质量评审", color: "#00d4ff", emoji: "\u{1F50E}" },
  growth: { name: "增长专家", color: "#f59e0b", emoji: "\u{1F4C8}" },
  user: { name: "你", color: "#4ade80", emoji: "\u{1F464}" },
};

const PHASE_NAMES = ["探索", "策略", "搭建", "构建", "加固", "发布"];

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
      title="复制内容"
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
        title="满意"
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
        title="不满意"
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
              {msg.messageType === "brief" ? "需求简报" : msg.messageType}
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
                展开全文
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
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{
              background: `linear-gradient(135deg, ${agent.color}25, ${agent.color}08)`,
              border: `1.5px solid ${agent.color}40`,
            }}
          >
            {agent.emoji}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold" style={{ color: agent.color }}>{agent.name}</span>
            {statusIcon}
            {log.action && (
              <span className="text-[11px] text-muted-foreground truncate">{log.action}</span>
            )}
            {log.durationMs && (
              <span className="text-[10px] text-muted-foreground/50 ml-auto flex-shrink-0">
                {(log.durationMs / 1000).toFixed(1)}s
              </span>
            )}
            {hasLongContent && (
              <ChevronDown
                className={`w-3 h-3 text-muted-foreground/50 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
              />
            )}
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

// ─── Requirement Brief Review Component ─────────────────────────────
// Shown when task status is "confirming" — user reviews the brief before pipeline execution

function RequirementBriefReview({
  taskId,
  task,
  onApproved,
  onReturnToMeeting,
}: {
  taskId: number;
  task: any;
  onApproved: () => void;
  onReturnToMeeting: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBrief, setEditedBrief] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get the brief from the task's requirementsBrief field
  const briefData = task?.requirementsBrief as { brief?: string; editedByUser?: boolean } | null;
  const briefText = briefData?.brief || "";
  const wasEdited = briefData?.editedByUser || false;

  const approveMutation = trpc.task.approveBrief.useMutation({
    onSuccess: () => {
      onApproved();
    },
  });

  const updateBriefMutation = trpc.task.updateBrief.useMutation({
    onSuccess: () => {
      setIsEditing(false);
      // Refetch task to get updated brief
    },
  });

  const returnMutation = trpc.task.returnToMeeting.useMutation({
    onSuccess: () => {
      onReturnToMeeting();
    },
  });

  const exportQuery = trpc.task.exportMeeting.useQuery(
    { taskId },
    { enabled: false }
  );

  const isProcessing = approveMutation.isPending || updateBriefMutation.isPending || returnMutation.isPending;

  const handleStartEdit = () => {
    setEditedBrief(briefText);
    setIsEditing(true);
    // Focus textarea after render
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleSaveEdit = () => {
    if (editedBrief.trim()) {
      updateBriefMutation.mutate({ taskId, brief: editedBrief.trim() });
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditedBrief("");
  };

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
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 bg-amber-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">审核需求简报</h3>
              <p className="text-xs text-muted-foreground">
                请在启动流水线之前审核以下需求简报。
                {wasEdited && (
                  <span className="ml-1 text-amber-400">(已由你编辑)</span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exportQuery.isFetching}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all disabled:opacity-50"
title="导出会议记录为 Markdown"
              >
                {exportQuery.isFetching ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                <span className="hidden sm:inline">导出 .md</span>
              </button>
          </div>
        </div>
      </div>

      {/* Brief Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-3xl mx-auto">
          {/* Status Banner */}
          <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-400">需要确认</p>
              <p className="text-xs text-muted-foreground mt-1">
                产品经理已根据会议讨论生成了需求简报。
                请仔细审核——这将作为流水线中 9 个智能体的唯一任务依据。
              </p>
            </div>
          </div>

          {/* Brief Card */}
          {isEditing ? (
            <div className="rounded-2xl border border-amber-500/30 bg-card/80 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50 bg-amber-500/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-semibold text-amber-400">编辑需求简报</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCancelEdit}
                    disabled={isProcessing}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg border border-border/50 text-muted-foreground hover:text-foreground transition-all disabled:opacity-50"
                  >
                    <X className="w-3 h-3" />
                    取消
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    disabled={isProcessing || !editedBrief.trim()}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-all disabled:opacity-50"
                  >
                    {updateBriefMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    保存修改
                  </button>
                </div>
              </div>
              <textarea
                ref={textareaRef}
                value={editedBrief}
                onChange={e => setEditedBrief(e.target.value)}
                className="w-full min-h-[400px] p-4 bg-transparent text-foreground/90 text-sm font-mono resize-y focus:outline-none"
                placeholder="以 Markdown 格式编辑需求简报..."
                disabled={isProcessing}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-amber-500/30 bg-card/80 overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50 bg-amber-500/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span className="text-sm font-semibold">需求简报</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400">
                    产品经理生成
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CopyButton text={briefText} />
                  <button
                    onClick={handleStartEdit}
                    disabled={isProcessing}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-border/50 text-muted-foreground hover:text-amber-400 hover:border-amber-500/30 transition-all disabled:opacity-50"
                  >
                    <Edit3 className="w-3 h-3" />
                    编辑
                  </button>
                </div>
              </div>
              <div className="p-5">
                <div className="prose prose-invert prose-sm max-w-none
                  prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2
                  prose-h1:text-lg prose-h1:text-amber-400 prose-h1:border-b prose-h1:border-amber-500/20 prose-h1:pb-2
                  prose-h2:text-base prose-h2:text-foreground
                  prose-p:text-foreground/80 prose-p:leading-relaxed
                  prose-li:text-foreground/80
                  prose-code:text-prism-cyan prose-code:bg-prism-cyan/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded
                  prose-pre:bg-[#0a1628] prose-pre:border prose-pre:border-border/30 prose-pre:rounded-lg
                  prose-strong:text-foreground
                  prose-a:text-prism-cyan prose-a:no-underline hover:prose-a:underline
                ">
                  <Streamdown>{briefText || "*暂无简报内容*"}</Streamdown>
                </div>
              </div>
            </div>
          )}

          {/* Error messages */}
          {approveMutation.isError && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              启动流水线失败：{approveMutation.error?.message || "未知错误"}
            </div>
          )}
          {returnMutation.isError && (
            <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              返回会议失败：{returnMutation.error?.message || "未知错误"}
            </div>
          )}
        </div>
      </div>

      {/* Action Bar */}
      <div className="border-t border-border/50 p-4 bg-card/30">
        <div className="flex items-center justify-between max-w-3xl mx-auto">
          {/* Left: Return to Meeting */}
          <button
            onClick={() => returnMutation.mutate({ taskId })}
            disabled={isProcessing || isEditing}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all disabled:opacity-50"
          >
            {returnMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RotateCcw className="w-4 h-4" />
            )}
            返回会议
          </button>

          {/* Right: Approve & Execute */}
          <div className="flex items-center gap-3">
            {!isEditing && (
              <button
                onClick={handleStartEdit}
                disabled={isProcessing}
                className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-all disabled:opacity-50"
              >
                <Edit3 className="w-4 h-4" />
                编辑简报
              </button>
            )}
            <button
              onClick={() => approveMutation.mutate({ taskId })}
              disabled={isProcessing || isEditing}
              className="flex items-center gap-2 px-6 py-2.5 bg-prism-cyan text-prism-navy font-semibold rounded-xl hover:bg-prism-cyan/90 transition-colors disabled:opacity-50 shadow-lg shadow-prism-cyan/20"
            >
              {approveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              确认并执行
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Meeting View Component ─────────────────────────────────────────

function MeetingView({
  taskId,
  task,
  onEndMeeting,
}: {
  taskId: number;
  task: any;
  onEndMeeting: () => void;
}) {
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const prevMessageCountRef = useRef(0);
  const userScrolledUpRef = useRef(false);

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

  const endMeetingMutation = trpc.task.endMeeting.useMutation({
    onSuccess: () => {
      onEndMeeting();
    },
  });

  const exportQuery = trpc.task.exportMeeting.useQuery(
    { taskId },
    { enabled: false }
  );

  const messages = meetingQuery.data || [];
  const feedbacks = feedbacksQuery.data || [];
  const agentMessages = messages.filter(m => m.sender !== "user");
  const isProcessing = replyMutation.isPending || endMeetingMutation.isPending;

  // Build feedback lookup: messageId -> rating
  const feedbackMap = useMemo(() => {
    const map: Record<number, "satisfied" | "unsatisfied"> = {};
    for (const fb of feedbacks) {
      map[fb.messageId] = fb.rating as "satisfied" | "unsatisfied";
    }
    return map;
  }, [feedbacks]);

  // Track if user has scrolled up from bottom
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Consider "near bottom" if within 100px of the bottom
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      userScrolledUpRef.current = !isNearBottom;
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll only when new messages arrive AND user is at the bottom
  useEffect(() => {
    const newCount = messages.length;
    const hadNewMessages = newCount > prevMessageCountRef.current;
    prevMessageCountRef.current = newCount;

    // Only auto-scroll if there are genuinely new messages and user hasn't scrolled up
    if (hadNewMessages && !userScrolledUpRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
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
              <h3 className="text-sm font-semibold">需求会议</h3>
              <p className="text-xs text-muted-foreground">
                {messages.length === 0
                  ? "智能体正在分析你的任务..."
                  : `第 ${task?.meetingRound || 1} 轮 — ${agentMessages.length} 条智能体消息`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Export button */}
            {messages.length > 0 && (
              <button
                onClick={handleExport}
                disabled={exportQuery.isFetching}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:border-border transition-all disabled:opacity-50"
                title="导出会议记录为 Markdown"
              >
                {exportQuery.isFetching ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Download className="w-3 h-3" />
                )}
                <span className="hidden sm:inline">导出 .md</span>
              </button>
            )}
            {/* End Meeting button — generates brief and transitions to confirming */}
            {messages.length > 0 && (
              <button
                onClick={() => endMeetingMutation.mutate({ taskId })}
                disabled={isProcessing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/25 transition-all disabled:opacity-50"
              >
                {endMeetingMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3 h-3" />
                )}
                结束会议
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Meeting Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
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
                指挥官、调研员和产品经理正在分析你的任务...
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                通常需要 15-30 秒
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
                智能体正在处理你的回复...
              </div>
            )}
            {endMeetingMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pl-12">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                产品经理正在生成需求简报...
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Reply Input */}
      {messages.length > 0 && (
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
                placeholder="回复会议讨论..."
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
              <span className="hidden sm:inline">回复</span>
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground/50 text-center mt-2">
            回答以上问题，或点击“结束会议”生成需求简报进行审核。
          </p>
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
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const prevLogsCountRef = useRef(0);
  const userScrolledUpLogsRef = useRef(false);

  const projectQuery = trpc.project.get.useQuery({ id: projectId }, { enabled: isAuthenticated && projectId > 0 });
  const tasksQuery = trpc.task.list.useQuery({ projectId }, { enabled: isAuthenticated && projectId > 0 });
  const activeTask = tasksQuery.data?.find(t => t.id === activeTaskId);
  const isRunning = activeTask?.status === "running";

  // SSE real-time events (active during pipeline execution)
  const {
    connectionState: sseState,
    events: sseEvents,
    clearEvents: clearSSEEvents,
  } = useTaskSSE({
    taskId: activeTaskId,
    enabled: isRunning,
    onTaskStatus: useCallback((event: { status: string }) => {
      // When task completes/fails via SSE, refetch task list to update status
      if (event.status === "completed" || event.status === "failed") {
        tasksQuery.refetch();
      }
    }, []),
  });

  // Fallback polling: only when SSE is NOT connected (initial load, completed tasks, etc.)
  const logsQuery = trpc.task.logs.useQuery(
    { taskId: activeTaskId! },
    {
      enabled: !!activeTaskId && sseState !== "connected",
      refetchInterval: sseState === "connected" ? false : 2000,
    }
  );

  // Merge SSE events into log-like format for rendering
  const sseLogsFromEvents = useMemo(() => {
    return sseEvents
      .filter(e => e.type === "agent:output" || e.type === "agent:status")
      .map((e, i) => {
        if (e.type === "agent:output") {
          return {
            id: `sse-${i}`,
            agentRole: e.agent.role,
            agentName: e.agent.name,
            phase: e.phase,
            action: "",
            content: e.content,
            status: "done" as const,
            createdAt: new Date(e.timestamp),
          };
        }
        if (e.type === "agent:status") {
          return {
            id: `sse-${i}`,
            agentRole: e.agent.role,
            agentName: e.agent.name,
            phase: e.phase,
            action: e.action,
            content: e.action,
            status: e.status,
            createdAt: new Date(e.timestamp),
          };
        }
        return null;
      })
      .filter(Boolean);
  }, [sseEvents]);

  // Use SSE logs when connected, otherwise fall back to polling
  const effectiveLogs = sseState === "connected" && sseLogsFromEvents.length > 0
    ? sseLogsFromEvents
    : (logsQuery.data || []) as any[];

  const createTaskMutation = trpc.task.create.useMutation({
    onSuccess: (data) => {
      setActiveTaskId(data.id);
      setPrompt("");
      setSelectedTemplate(null);
      tasksQuery.refetch();
    },
  });

  // Auto-select latest running/clarifying/confirming task
  useEffect(() => {
    if (!activeTaskId && tasksQuery.data?.length) {
      const active = tasksQuery.data.find(t =>
        t.status === "running" || t.status === "clarifying" || t.status === "confirming"
      );
      setActiveTaskId(active?.id || tasksQuery.data[0].id);
    }
  }, [tasksQuery.data, activeTaskId]);

  // Track if user has scrolled up in logs view
  useEffect(() => {
    const container = logsContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      userScrolledUpLogsRef.current = !isNearBottom;
    };
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll logs only when new entries arrive AND user is at the bottom
  useEffect(() => {
    const newCount = effectiveLogs.length;
    const hadNewLogs = newCount > prevLogsCountRef.current;
    prevLogsCountRef.current = newCount;
    if (hadNewLogs && !userScrolledUpLogsRef.current) {
      logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [effectiveLogs]);

  // Refetch tasks while any is active
  useEffect(() => {
    if (!tasksQuery.data?.some(t => ["running", "pending", "clarifying", "confirming"].includes(t.status))) return;
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
          <span className="text-sm text-muted-foreground font-mono">加载工作区中...</span>
        </div>
      </div>
    );
  }

  const project = projectQuery.data;
  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">项目未找到</h2>
          <Link href="/dashboard" className="text-prism-cyan hover:underline">返回控制台</Link>
        </div>
      </div>
    );
  }

  const logs = effectiveLogs;
  const tasks = tasksQuery.data || [];
  const latestDoneLogId = [...logs].reverse().find((l: any) => l.status === "done")?.id;

  // Determine what view to show for the active task
  const isMeetingPhase = activeTask?.status === "clarifying" || (activeTask?.status === "pending" && !activeTask?.meetingRound);
  const isConfirmingPhase = activeTask?.status === "confirming";
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
              <span className="text-sm hidden sm:inline">控制台</span>
            </Link>
            <ChevronRight className="w-3 h-3 text-border" />
            <span className="font-display font-semibold text-sm truncate max-w-[200px]">{project.name}</span>
            {activeTask?.status === "clarifying" && (
              <span className="flex items-center gap-1 text-xs text-prism-amber">
                <MessageSquare className="w-3 h-3" />
                需求会议
              </span>
            )}
            {activeTask?.status === "confirming" && (
              <span className="flex items-center gap-1 text-xs text-amber-400">
                <ShieldCheck className="w-3 h-3" />
                审核简报
              </span>
            )}
            {activeTask?.status === "running" && (
              <span className="flex items-center gap-1 text-xs text-prism-cyan">
                <span className="w-1.5 h-1.5 rounded-full bg-prism-cyan animate-pulse" />
                智能体工作中...
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
                  监控
                </Link>
                {activeTask?.status === "completed" && (
                  <Link
                    href={`/results/${activeTaskId}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-prism-cyan/10 border border-prism-cyan/30 text-prism-cyan hover:bg-prism-cyan/20 transition-all"
                  >
                    <FileText className="w-3 h-3" />
                    <span className="hidden sm:inline">查看结果</span>
                    <span className="sm:hidden">结果</span>
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
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">任务列表</h3>
          </div>
          <div className="p-2 space-y-1 max-h-[200px] lg:max-h-[calc(100vh-220px)] overflow-y-auto flex lg:flex-col flex-row gap-1 lg:gap-0">
            {tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground p-3">暂无任务。在下方创建一个。</p>
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
                    ) : task.status === "confirming" ? (
                      <ShieldCheck className="w-3 h-3 text-amber-400 flex-shrink-0" />
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
          {/* Model Selector */}
          <div className="hidden lg:block p-3 border-t border-border/50">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">AI 模型</p>
            <ModelSelector projectId={projectId} />
          </div>
        </div>

        {/* Center: Main View Area */}
        <div className="flex-1 flex flex-col">
          {/* Meeting View */}
          {activeTaskId && isMeetingPhase && (
            <MeetingView
              taskId={activeTaskId}
              task={activeTask}
              onEndMeeting={() => tasksQuery.refetch()}
            />
          )}

          {/* Requirement Brief Confirmation View */}
          {activeTaskId && isConfirmingPhase && (
            <RequirementBriefReview
              taskId={activeTaskId}
              task={activeTask}
              onApproved={() => tasksQuery.refetch()}
              onReturnToMeeting={() => tasksQuery.refetch()}
            />
          )}

          {/* Pipeline View */}
          {activeTaskId && isPipelinePhase && (
            <>
              <div ref={logsContainerRef} className="flex-1 overflow-y-auto p-4 space-y-1">
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
                      <p className="text-sm text-muted-foreground">正在初始化智能体流水线...</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Task Result */}
              {activeTask?.status === "completed" && activeTask.result != null && (
                <div className="mx-4 mb-3 space-y-3">
                  <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-sm font-semibold text-emerald-400">流水线完成</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/monitor/${activeTaskId}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md border border-border hover:bg-card hover:border-prism-cyan/30 transition-all text-muted-foreground hover:text-prism-cyan"
                        >
                          <BarChart3 className="w-3 h-3" />
                          监控
                        </Link>
                        <Link
                          href={`/results/${activeTaskId}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-prism-cyan text-prism-navy hover:bg-prism-cyan/90 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          查看完整结果
                        </Link>
                      </div>
                    </div>
                    <p className="text-sm text-foreground/80">
                      {(() => {
                        const r = activeTask.result as Record<string, unknown> | null;
                        return String(r?.summary ?? "任务已成功完成。");
                      })()}
                    </p>
                  </div>
                  {/* Verification Report — compact mode */}
                  <div className="p-4 rounded-xl border border-border/30 bg-card/20">
                    <VerificationReportCard taskId={activeTaskId!} mode="compact" />
                  </div>
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
                <h3 className="text-lg font-semibold mb-2">准备开始协作</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  选择一个模板快速开始，或在下方描述你的任务。
                </p>

                {/* Template Cards */}
                <TemplateSelector onSelect={handleTemplateSelect} />

                {selectedTemplate && (
                  <div className="mt-4 p-3 rounded-lg bg-prism-cyan/5 border border-prism-cyan/20 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-prism-cyan" />
                      <span className="text-xs font-medium text-prism-cyan">已选择模板</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      你可以在开始之前编辑下方的提示词。
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Input Bar — only show when not in meeting/confirming phase */}
          {(!activeTaskId || isPipelinePhase || (!isMeetingPhase && !isConfirmingPhase && !isPipelinePhase)) && (
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
                    placeholder="描述你的任务...（例如：构建一个社交电商平台）"
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
                  <span className="hidden sm:inline">运行</span>
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
                  {skipMeeting ? "快速模式（跳过会议）" : "会议模式（推荐）"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
