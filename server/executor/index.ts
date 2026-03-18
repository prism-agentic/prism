/**
 * PRISM TaskExecutor 模块 — 统一导出
 *
 * 使用方式：
 * ```typescript
 * import { runTask, type ExecutorContext } from "./executor";
 * ```
 */

// 核心接口和类型
export type { TaskExecutor, ExecutorContext, ExecutorConfig } from "./types";

// 编排层（主入口）
export {
  runTask,
  isTaskRunning,
  abortTask,
  getRunningTaskCount,
  getRunningTaskIds,
} from "./orchestrator";

// 事件总线
export {
  emitTaskEvent,
  subscribeTaskEvents,
  getListenerCount,
} from "./eventBus";

// Agent 注册表
export {
  AGENT_REGISTRY,
  PIPELINE_PHASES,
  AGENT_LIST,
  getActionLabel,
  buildAgentContext,
  type AgentDefinition,
  type PhaseDefinition,
} from "./agentRegistry";

// 执行器实现（通常不需要直接使用，通过 Orchestrator 调用）
export { SequentialExecutor } from "./sequentialExecutor";

// LLM 辅助函数（供修复循环等外部使用）
export { callAgent, callAgentWithContext } from "./llmHelper";
