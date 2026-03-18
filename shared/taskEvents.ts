/**
 * PRISM TaskEvent 事件系统 — 核心类型定义
 *
 * 这是整个 TaskExecutor 抽象层的关键。无论底层执行引擎如何变化，
 * 前端只消费 TaskEvent 流。所有执行器（SequentialExecutor、ConcurrentExecutor 等）
 * 都通过 AsyncGenerator<TaskEvent> 产出统一格式的事件。
 *
 * 设计原则：
 * - 事件是不可变的、自描述的
 * - 每个事件携带 taskId 和 timestamp，支持回放和调试
 * - 事件类型通过 discriminated union 区分，前端用 switch-case 消费
 */

import type { GatePhase, VerificationReport } from "./verification";

// ─── Agent 身份信息 ─────────────────────────────────────────

/** Agent 身份信息，用于事件中标识 Agent */
export interface AgentIdentity {
  /** 显示名称，如 "指挥官" */
  name: string;
  /** 角色标识，如 "conductor" */
  role: string;
  /** 所属部门，如 "specialized" */
  department: string;
  /** 头像 URL（可选） */
  avatar?: string;
}

// ─── 流水线阶段信息 ─────────────────────────────────────────

/** 流水线阶段信息 */
export interface PipelinePhase {
  /** 阶段序号 (0-5) */
  index: number;
  /** 阶段名称，如 "Discover" */
  name: string;
  /** 该阶段参与的 Agent 角色列表 */
  agents: string[];
}

// ─── 事件类型定义 ─────────────────────────────────────────

/** 任务状态变更 */
export interface TaskStatusEvent {
  type: "task:status";
  taskId: number;
  status: "pending" | "clarifying" | "confirming" | "running" | "completed" | "failed";
  timestamp: number;
}

/** 流水线阶段变更 */
export interface PhaseChangeEvent {
  type: "phase:change";
  taskId: number;
  phase: PipelinePhase;
  timestamp: number;
}

/** Agent 状态变更 */
export interface AgentStatusEvent {
  type: "agent:status";
  taskId: number;
  agent: AgentIdentity;
  phase: number;
  status: "thinking" | "working" | "reviewing" | "done" | "error";
  /** 当前动作描述，如 "分析与拆解任务" */
  action: string;
  timestamp: number;
}

/** Agent 输出内容（支持流式） */
export interface AgentOutputEvent {
  type: "agent:output";
  taskId: number;
  agent: AgentIdentity;
  phase: number;
  /** Markdown 内容（完整或增量） */
  content: string;
  /** true = 增量追加，false = 完整替换 */
  isStreaming: boolean;
  timestamp: number;
}

/** 会议消息（需求会议阶段） */
export interface MeetingMessageEvent {
  type: "meeting:message";
  taskId: number;
  /** "user" | "conductor" | "researcher" | "pm" */
  sender: string;
  content: string;
  /** "analysis" | "research" | "questions" | "reply" | "followup" | "brief" */
  messageType: string;
  round: number;
  timestamp: number;
}

/** 质量门控事件 */
export interface GateEvent {
  type: "gate:status";
  taskId: number;
  gate: GatePhase;
  phase: number;
  status: "started" | "verifying" | "passed" | "failed" | "fixing" | "degraded_pass";
  /** 门控评分（验证完成后） */
  score?: number;
  /** 门控阈值 */
  threshold?: number;
  /** 验证报告（验证完成后） */
  report?: VerificationReport;
  /** 描述信息 */
  message: string;
  timestamp: number;
}

/** 交付物产出 */
export interface ArtifactEvent {
  type: "artifact:created";
  taskId: number;
  artifact: {
    id: number;
    type: "text" | "code" | "bundle";
    title: string;
    agentRole: string;
    phase: number;
    filename?: string;
    language?: string;
    /** 前 200 字符预览 */
    contentPreview: string;
  };
  timestamp: number;
}

/** 错误事件 */
export interface ErrorEvent {
  type: "error";
  taskId: number;
  agent?: AgentIdentity;
  message: string;
  recoverable: boolean;
  timestamp: number;
}

// ─── 联合类型 ─────────────────────────────────────────

/** 所有事件的联合类型 */
export type TaskEvent =
  | TaskStatusEvent
  | PhaseChangeEvent
  | AgentStatusEvent
  | AgentOutputEvent
  | MeetingMessageEvent
  | GateEvent
  | ArtifactEvent
  | ErrorEvent;

/** 事件类型字符串联合 */
export type TaskEventType = TaskEvent["type"];
