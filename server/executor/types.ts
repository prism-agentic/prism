/**
 * TaskExecutor 抽象接口 — 执行引擎的统一契约
 *
 * 所有执行策略（串行、并发、混合）都实现此接口。
 * 通过 AsyncGenerator 产出 TaskEvent 流，上层（Orchestrator / SSE / 前端）
 * 只消费事件流，不关心底层执行细节。
 */

import type { TaskEvent } from "../../shared/taskEvents";

// ─── 执行器配置 ─────────────────────────────────────────

/** 执行器配置 */
export interface ExecutorConfig {
  /** LLM 模型 ID（如 "google/gemini-2.5-flash"） */
  modelId?: string;
  /** 最大重试次数（默认 3） */
  maxRetries?: number;
  /** 单个 Agent 的最大输出 token 数（默认 4096） */
  maxTokensPerAgent?: number;
  /** 需求简报（来自会议阶段） */
  requirementsBrief?: string;
}

// ─── 执行器上下文 ─────────────────────────────────────────

/** 执行器上下文（注入到每次执行中） */
export interface ExecutorContext {
  /** 任务 ID */
  taskId: number;
  /** 用户 ID */
  userId: number;
  /** 项目 ID */
  projectId: number;
  /** 用户的原始需求 */
  prompt: string;
  /** 执行器配置 */
  config: ExecutorConfig;
}

// ─── TaskExecutor 接口 ─────────────────────────────────────

/**
 * TaskExecutor — 任务执行器抽象接口
 *
 * 所有执行引擎（单 Agent、串行多 Agent、并发 Pipeline）都实现此接口。
 * 通过 AsyncGenerator 产出 TaskEvent 流，前端实时消费。
 *
 * @example
 * ```typescript
 * const executor = new SequentialExecutor();
 * for await (const event of executor.execute(ctx)) {
 *   // 持久化事件到数据库
 *   // 推送事件到前端（SSE/WebSocket）
 * }
 * ```
 */
export interface TaskExecutor {
  /** 执行器名称，用于日志和调试 */
  readonly name: string;

  /**
   * 执行任务，产出事件流。
   *
   * @param ctx - 执行上下文
   * @yields TaskEvent - 任务执行过程中的事件
   */
  execute(ctx: ExecutorContext): AsyncGenerator<TaskEvent, void, unknown>;
}
