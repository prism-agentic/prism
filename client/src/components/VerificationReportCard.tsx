/**
 * VerificationReportCard — 验证报告摘要卡片
 *
 * 展示三个质量门控（策略、构建、最终）的验证状态、评分和验收标准逐条结果。
 * 支持两种模式：
 * - compact: 紧凑模式，适用于 Workspace 侧边栏
 * - full: 完整模式，适用于 TaskResults 页面
 */
import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Minus,
  Loader2,
  FileCheck,
  Target,
} from "lucide-react";
import type {
  GatePhase,
  CriterionStatus,
  CriterionPriority,
} from "@shared/verification";

// ─── Gate Display Config ─────────────────────────────────────
interface GateDisplayConfig {
  label: string;
  labelEn: string;
  description: string;
  threshold: number;
}

const GATE_DISPLAY: Record<GatePhase, GateDisplayConfig> = {
  post_strategy: {
    label: "策略门控",
    labelEn: "Strategy Gate",
    description: "验证 PM/UX 输出是否覆盖核心需求",
    threshold: 80,
  },
  post_build: {
    label: "构建门控",
    labelEn: "Build Gate",
    description: "验证实现是否与策略一致",
    threshold: 75,
  },
  final: {
    label: "最终验证",
    labelEn: "Final Gate",
    description: "逐条对照所有验收标准",
    threshold: 85,
  },
};

const GATE_ORDER: GatePhase[] = ["post_strategy", "post_build", "final"];

// ─── Status Helpers ──────────────────────────────────────────
function getStatusIcon(status: CriterionStatus, size = "w-4 h-4") {
  switch (status) {
    case "pass":
      return <CheckCircle2 className={`${size} text-emerald-400`} />;
    case "fail":
      return <XCircle className={`${size} text-red-400`} />;
    case "partial":
      return <AlertTriangle className={`${size} text-amber-400`} />;
    case "not_applicable":
      return <Minus className={`${size} text-muted-foreground/50`} />;
  }
}

function getStatusLabel(status: CriterionStatus) {
  switch (status) {
    case "pass": return "通过";
    case "fail": return "失败";
    case "partial": return "部分通过";
    case "not_applicable": return "不适用";
  }
}

function getPriorityBadge(priority: CriterionPriority) {
  switch (priority) {
    case "must":
      return (
        <Badge variant="outline" className="text-[9px] px-1 py-0 border-red-400/30 text-red-400">
          MUST
        </Badge>
      );
    case "should":
      return (
        <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-400/30 text-amber-400">
          SHOULD
        </Badge>
      );
    case "nice_to_have":
      return (
        <Badge variant="outline" className="text-[9px] px-1 py-0 border-muted-foreground/30 text-muted-foreground">
          NICE
        </Badge>
      );
  }
}

function getScoreColor(score: number, threshold: number): string {
  if (score >= threshold) return "text-emerald-400";
  if (score >= threshold * 0.8) return "text-amber-400";
  return "text-red-400";
}

function getGateIcon(pass: boolean | null, isLoading: boolean) {
  if (isLoading) return <Loader2 className="w-5 h-5 text-prism-cyan animate-spin" />;
  if (pass === null) return <Shield className="w-5 h-5 text-muted-foreground/40" />;
  if (pass) return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
  return <ShieldAlert className="w-5 h-5 text-red-400" />;
}

function getProgressColor(score: number, threshold: number): string {
  if (score >= threshold) return "[&>div]:bg-emerald-400";
  if (score >= threshold * 0.8) return "[&>div]:bg-amber-400";
  return "[&>div]:bg-red-400";
}

// ─── Types ───────────────────────────────────────────────────
interface CriteriaItem {
  id: number;
  taskId: number;
  criterionId: string;
  source: string;
  description: string;
  verifyMethod: string;
  relatedAgents: unknown;
  priority: string;
  createdAt: Date;
}

interface ReportItem {
  id: number;
  taskId: number;
  gate: string;
  results: unknown;
  overallScore: number;
  gatePass: number;
  gateThreshold: number;
  fixRound: number;
  verifiedAt: Date;
  createdAt: Date;
}

interface CriterionResultItem {
  criterionId: string;
  status: CriterionStatus;
  reasoning: string;
  fixAgent?: string;
  fixSuggestion?: string;
}

// ─── Single Gate Card ────────────────────────────────────────
function GateCard({
  gate,
  report,
  criteria,
  isExpanded,
  onToggle,
  compact,
}: {
  gate: GatePhase;
  report: ReportItem | null;
  criteria: CriteriaItem[];
  isExpanded: boolean;
  onToggle: () => void;
  compact: boolean;
}) {
  const config = GATE_DISPLAY[gate];
  const hasReport = report !== null;
  const pass = hasReport ? report.gatePass === 1 : null;
  const score = hasReport ? report.overallScore : 0;
  const results = hasReport
    ? (report.results as CriterionResultItem[] | null) || []
    : [];

  // Match criteria with results
  const criteriaWithResults = useMemo(() => {
    return criteria.map(c => {
      const result = results.find(r => r.criterionId === c.criterionId);
      return { criterion: c, result };
    });
  }, [criteria, results]);

  const passCount = results.filter(r => r.status === "pass").length;
  const failCount = results.filter(r => r.status === "fail").length;
  const partialCount = results.filter(r => r.status === "partial").length;

  return (
    <div className={`rounded-lg border transition-all ${
      hasReport
        ? pass
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-red-500/30 bg-red-500/5"
        : "border-border/30 bg-card/20"
    }`}>
      {/* Gate Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-card/30 transition-colors rounded-lg"
      >
        {getGateIcon(pass, false)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{config.label}</span>
            {hasReport && (
              <span className={`text-xs font-mono font-bold ${getScoreColor(score, config.threshold)}`}>
                {score}分
              </span>
            )}
          </div>
          {!compact && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{config.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {hasReport && (
            <div className="flex items-center gap-1.5 text-[10px]">
              {passCount > 0 && (
                <span className="text-emerald-400">{passCount} 通过</span>
              )}
              {failCount > 0 && (
                <span className="text-red-400">{failCount} 失败</span>
              )}
              {partialCount > 0 && (
                <span className="text-amber-400">{partialCount} 部分</span>
              )}
            </div>
          )}
          {!hasReport && (
            <span className="text-[10px] text-muted-foreground/50">待验证</span>
          )}
          {hasReport && (
            isExpanded
              ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Score Progress Bar */}
      {hasReport && (
        <div className="px-3 pb-2">
          <Progress
            value={score}
            className={`h-1.5 bg-border/20 ${getProgressColor(score, config.threshold)}`}
          />
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-muted-foreground/50">0</span>
            <span className="text-[9px] text-muted-foreground/50">
              阈值: {config.threshold}
            </span>
            <span className="text-[9px] text-muted-foreground/50">100</span>
          </div>
        </div>
      )}

      {/* Expanded: Criteria Details */}
      {isExpanded && hasReport && (
        <div className="border-t border-border/20 px-3 py-2 space-y-1.5">
          {criteriaWithResults.map(({ criterion, result }) => (
            <div
              key={criterion.criterionId}
              className="flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-card/30 transition-colors"
            >
              {result
                ? getStatusIcon(result.status, "w-3.5 h-3.5 mt-0.5 flex-shrink-0")
                : <Minus className="w-3.5 h-3.5 mt-0.5 text-muted-foreground/30 flex-shrink-0" />
              }
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-muted-foreground/60">
                    {criterion.criterionId}
                  </span>
                  {getPriorityBadge(criterion.priority as CriterionPriority)}
                </div>
                <p className="text-xs text-foreground/80 mt-0.5 leading-relaxed">
                  {criterion.description}
                </p>
                {result?.reasoning && (
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed italic">
                    {result.reasoning}
                  </p>
                )}
                {result?.fixSuggestion && result.status === "fail" && (
                  <p className="text-[11px] text-amber-400/80 mt-1 leading-relaxed">
                    修复建议: {result.fixSuggestion}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Overall Summary Bar ─────────────────────────────────────
function OverallSummary({
  reports,
  criteria,
}: {
  reports: ReportItem[];
  criteria: CriteriaItem[];
}) {
  const gatesCompleted = reports.length;
  const gatesPassed = reports.filter(r => r.gatePass === 1).length;
  const avgScore = reports.length > 0
    ? Math.round(reports.reduce((sum, r) => sum + r.overallScore, 0) / reports.length)
    : 0;

  const allPassed = gatesCompleted === 3 && gatesPassed === 3;
  const hasFailed = reports.some(r => r.gatePass === 0);

  return (
    <div className={`rounded-xl border p-4 mb-4 ${
      allPassed
        ? "border-emerald-500/30 bg-emerald-500/5"
        : hasFailed
          ? "border-red-500/20 bg-red-500/5"
          : "border-prism-cyan/20 bg-prism-cyan/5"
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {allPassed ? (
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          ) : hasFailed ? (
            <ShieldX className="w-6 h-6 text-red-400" />
          ) : (
            <Shield className="w-6 h-6 text-prism-cyan" />
          )}
          <div>
            <h3 className="font-semibold text-sm">
              {allPassed
                ? "全部门控通过"
                : hasFailed
                  ? "存在未通过的门控"
                  : gatesCompleted === 0
                    ? "等待验证"
                    : `${gatesPassed}/${gatesCompleted} 门控通过`
              }
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {criteria.length} 条验收标准 · {gatesCompleted}/3 门控已完成
              {avgScore > 0 && ` · 平均 ${avgScore} 分`}
            </p>
          </div>
        </div>

        {/* Mini gate indicators */}
        <div className="flex items-center gap-1.5">
          {GATE_ORDER.map(gate => {
            const report = reports.find(r => r.gate === gate);
            if (!report) {
              return (
                <div
                  key={gate}
                  className="w-8 h-8 rounded-md border border-border/30 bg-card/20 flex items-center justify-center"
                  title={GATE_DISPLAY[gate].label}
                >
                  <span className="text-[9px] text-muted-foreground/40">
                    {gate === "post_strategy" ? "G1" : gate === "post_build" ? "G2" : "G3"}
                  </span>
                </div>
              );
            }
            const pass = report.gatePass === 1;
            return (
              <div
                key={gate}
                className={`w-8 h-8 rounded-md border flex items-center justify-center ${
                  pass
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-red-500/30 bg-red-500/10"
                }`}
                title={`${GATE_DISPLAY[gate].label}: ${report.overallScore}分`}
              >
                <span className={`text-[10px] font-bold ${pass ? "text-emerald-400" : "text-red-400"}`}>
                  {report.overallScore}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────
export default function VerificationReportCard({
  taskId,
  mode = "full",
}: {
  taskId: number;
  mode?: "compact" | "full";
}) {
  const compact = mode === "compact";
  const [expandedGates, setExpandedGates] = useState<Set<GatePhase>>(new Set());

  // Fetch data
  const criteriaQuery = trpc.verification.getCriteria.useQuery(
    { taskId },
    { enabled: taskId > 0 }
  );
  const reportsQuery = trpc.verification.getReports.useQuery(
    { taskId },
    { enabled: taskId > 0 }
  );

  const criteria = (criteriaQuery.data || []) as CriteriaItem[];
  const reports = (reportsQuery.data || []) as ReportItem[];

  const isLoading = criteriaQuery.isLoading || reportsQuery.isLoading;

  // Get latest report per gate
  const latestReports = useMemo(() => {
    const map = new Map<string, ReportItem>();
    for (const r of reports) {
      const existing = map.get(r.gate);
      if (!existing || new Date(r.createdAt) > new Date(existing.createdAt)) {
        map.set(r.gate, r);
      }
    }
    return map;
  }, [reports]);

  // Get criteria relevant to each gate
  const criteriaByGate = useMemo(() => {
    const gateAgents: Record<GatePhase, string[]> = {
      post_strategy: ["conductor", "researcher", "pm", "ux"],
      post_build: ["backend", "frontend", "devops"],
      final: ["conductor", "researcher", "pm", "ux", "backend", "frontend", "devops", "critic"],
    };

    const result: Record<GatePhase, CriteriaItem[]> = {
      post_strategy: [],
      post_build: [],
      final: criteria, // Final gate checks all criteria
    };

    for (const c of criteria) {
      const agents = Array.isArray(c.relatedAgents)
        ? c.relatedAgents as string[]
        : [];
      for (const gate of ["post_strategy", "post_build"] as GatePhase[]) {
        if (agents.some(a => gateAgents[gate].includes(a))) {
          result[gate].push(c);
        }
      }
    }

    return result;
  }, [criteria]);

  const toggleGate = (gate: GatePhase) => {
    setExpandedGates(prev => {
      const next = new Set(prev);
      if (next.has(gate)) {
        next.delete(gate);
      } else {
        next.add(gate);
      }
      return next;
    });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={`rounded-xl border border-border/30 bg-card/20 p-4 ${compact ? "" : "p-6"}`}>
        <div className="flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-prism-cyan animate-spin" />
          <span className="text-sm text-muted-foreground">加载验证报告...</span>
        </div>
      </div>
    );
  }

  // No criteria yet — verification hasn't started
  if (criteria.length === 0) {
    return (
      <div className={`rounded-xl border border-border/30 bg-card/20 ${compact ? "p-3" : "p-5"}`}>
        <div className="flex items-center gap-3">
          <Target className="w-5 h-5 text-muted-foreground/40" />
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground">质量验证</h3>
            <p className="text-[11px] text-muted-foreground/60 mt-0.5">
              验收标准将在需求确认后自动提取
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={compact ? "" : ""}>
      {/* Section Header */}
      <div className="flex items-center gap-2 mb-3">
        <FileCheck className="w-4 h-4 text-prism-cyan" />
        <h2 className={`font-display font-semibold ${compact ? "text-sm" : "text-base"}`}>
          质量验证报告
        </h2>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {criteria.length} 条标准
        </Badge>
      </div>

      {/* Overall Summary */}
      {!compact && (
        <OverallSummary reports={Array.from(latestReports.values())} criteria={criteria} />
      )}

      {/* Compact Summary */}
      {compact && reports.length > 0 && (
        <div className="flex items-center gap-1.5 mb-3">
          {GATE_ORDER.map(gate => {
            const report = latestReports.get(gate);
            if (!report) {
              return (
                <div
                  key={gate}
                  className="flex-1 h-1.5 rounded-full bg-border/20"
                />
              );
            }
            const pass = report.gatePass === 1;
            return (
              <div
                key={gate}
                className={`flex-1 h-1.5 rounded-full ${
                  pass ? "bg-emerald-400" : "bg-red-400"
                }`}
              />
            );
          })}
        </div>
      )}

      {/* Gate Cards */}
      <div className={`space-y-2 ${compact ? "" : "space-y-3"}`}>
        {GATE_ORDER.map(gate => (
          <GateCard
            key={gate}
            gate={gate}
            report={latestReports.get(gate) || null}
            criteria={criteriaByGate[gate]}
            isExpanded={expandedGates.has(gate)}
            onToggle={() => toggleGate(gate)}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}
