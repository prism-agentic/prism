/**
 * PRISM 自动化验证流程 — 类型定义
 *
 * 核心概念：
 * - AcceptanceCriterion: 从需求简报中提取的单条可判定验收标准
 * - AcceptanceCriteriaSet: 一个任务的完整验收标准集
 * - CriterionResult: 单条标准的验证结果
 * - VerificationReport: 一次门控验证的完整报告
 * - FixRequest: 修复循环中的修复请求
 */

// ─── 验收标准 ───────────────────────────────────────────────

/** 验收标准的来源维度 */
export type CriterionSource =
  | "core_feature"
  | "tech_preference"
  | "success_metric"
  | "key_decision";

/** 验证方式 */
export type VerifyMethod =
  | "content_check"
  | "structure_check"
  | "consistency_check";

/** 优先级 */
export type CriterionPriority = "must" | "should" | "nice_to_have";

/** 单条验收标准 */
export interface AcceptanceCriterion {
  /** 唯一标识，格式 AC-001 */
  id: string;
  /** 来源：需求简报中的哪个部分 */
  source: CriterionSource;
  /** 标准描述（一句话，不超过 50 字） */
  description: string;
  /** 验证方式 */
  verifyMethod: VerifyMethod;
  /** 关联的 Agent 角色（哪些 Agent 的输出需要满足此标准） */
  relatedAgents: string[];
  /** 优先级 */
  priority: CriterionPriority;
}

/** 验收标准集 */
export interface AcceptanceCriteriaSet {
  taskId: number;
  /** 从需求简报自动提取的标准列表 */
  criteria: AcceptanceCriterion[];
  /** 提取时间（UTC ms） */
  generatedAt: number;
  /** 需求简报的摘要哈希（用于检测需求变更） */
  briefHash: string;
}

// ─── 验证结果 ───────────────────────────────────────────────

/** 验证状态 */
export type CriterionStatus = "pass" | "fail" | "partial" | "not_applicable";

/** 单条标准的验证结果 */
export interface CriterionResult {
  criterionId: string;
  /** 验证状态 */
  status: CriterionStatus;
  /** 验证说明 */
  reasoning: string;
  /** 如果失败，需要哪个 Agent 修复 */
  fixAgent?: string;
  /** 修复建议 */
  fixSuggestion?: string;
}

/** 门控阶段 */
export type GatePhase = "post_strategy" | "post_build" | "final";

/** 验证报告 */
export interface VerificationReport {
  taskId: number;
  /** 验证阶段 */
  phase: GatePhase;
  /** 各标准的验证结果 */
  results: CriterionResult[];
  /** 总体评分 (0-100) */
  overallScore: number;
  /** 是否通过门控 */
  gatePass: boolean;
  /** 门控阈值 */
  gateThreshold: number;
  /** 验证时间（UTC ms） */
  verifiedAt: number;
  /** 修复轮次（0 = 首次验证） */
  fixRound?: number;
}

// ─── 修复请求 ───────────────────────────────────────────────

/** 修复请求 */
export interface FixRequest {
  /** 失败的验收标准 */
  criterion: AcceptanceCriterion;
  /** 验证结果 */
  result: CriterionResult;
  /** 需要修复的 Agent 角色 */
  targetAgent: string;
  /** 该 Agent 之前的输出 */
  previousOutput: string;
  /** 修复建议 */
  suggestion: string;
}

// ─── 门控配置 ───────────────────────────────────────────────

/** 门控配置 */
export interface GateConfig {
  relevantAgents: string[];
  threshold: number;
  maxFixRounds: number;
}

/** 所有门控的配置 */
export const GATE_CONFIGS: Record<GatePhase, GateConfig> = {
  post_strategy: {
    relevantAgents: ["conductor", "researcher", "pm", "ux"],
    threshold: 80,
    maxFixRounds: 2,
  },
  post_build: {
    relevantAgents: ["backend", "frontend", "devops"],
    threshold: 75,
    maxFixRounds: 2,
  },
  final: {
    relevantAgents: [
      "conductor", "researcher", "pm", "ux",
      "backend", "frontend", "devops", "critic",
    ],
    threshold: 85,
    maxFixRounds: 1,
  },
};

// ─── 验证事件（用于 SSE 推送） ──────────────────────────────────

/** 验收标准提取完成 */
export interface CriteriaExtractedEvent {
  type: "verify:criteria_extracted";
  taskId: number;
  criteriaCount: number;
  mustCount: number;
  timestamp: number;
}

/** 质量门控开始 */
export interface GateStartEvent {
  type: "verify:gate_start";
  taskId: number;
  gate: GatePhase;
  criteriaCount: number;
  timestamp: number;
}

/** 单条标准验证完成 */
export interface CriterionVerifiedEvent {
  type: "verify:criterion_result";
  taskId: number;
  gate: GatePhase;
  criterionId: string;
  status: CriterionStatus;
  reasoning: string;
  timestamp: number;
}

/** 质量门控结果 */
export interface GateResultEvent {
  type: "verify:gate_result";
  taskId: number;
  gate: GatePhase;
  overallScore: number;
  gatePass: boolean;
  failedCriteria: string[];
  timestamp: number;
}

/** 修复循环开始 */
export interface FixLoopStartEvent {
  type: "verify:fix_start";
  taskId: number;
  gate: GatePhase;
  round: number;
  fixAgent: string;
  criterionId: string;
  timestamp: number;
}

/** 修复循环结果 */
export interface FixLoopResultEvent {
  type: "verify:fix_result";
  taskId: number;
  gate: GatePhase;
  round: number;
  fixAgent: string;
  success: boolean;
  timestamp: number;
}

/** 所有验证事件的联合类型 */
export type VerificationEvent =
  | CriteriaExtractedEvent
  | GateStartEvent
  | CriterionVerifiedEvent
  | GateResultEvent
  | FixLoopStartEvent
  | FixLoopResultEvent;
