/**
 * Orchestrator — 编排层
 *
 * 连接 tRPC API 和 TaskExecutor 的中间层，负责：
 * 1. 选择执行器（MVP 阶段固定使用 SequentialExecutor）
 * 2. 消费执行器产出的事件流
 * 3. 通过事件总线推送 SSE 事件
 * 4. 错误处理和恢复
 *
 * 调用方式：
 * ```typescript
 * // 在 routers.ts 中
 * runTask({ taskId, userId, projectId, prompt, config }).catch(console.error);
 * ```
 */

import { SequentialExecutor } from "./sequentialExecutor";
import { emitTaskEvent } from "./eventBus";
import type { ExecutorContext, TaskExecutor } from "./types";

// ─── 执行器注册表 ─────────────────────────────────────────

/** 可用的执行器实例 */
const executors: Record<string, TaskExecutor> = {
  sequential: new SequentialExecutor(),
  // concurrent: new ConcurrentExecutor(),  // 未来
};

/** 默认执行器名称 */
const DEFAULT_EXECUTOR = "sequential";

// ─── 运行中任务跟踪 ─────────────────────────────────────────

/** 运行中任务的 AbortController 映射 */
const runningTasks = new Map<number, AbortController>();

/**
 * 检查任务是否正在运行
 */
export function isTaskRunning(taskId: number): boolean {
  return runningTasks.has(taskId);
}

/**
 * 中止正在运行的任务
 */
export function abortTask(taskId: number): boolean {
  const controller = runningTasks.get(taskId);
  if (controller) {
    controller.abort();
    runningTasks.delete(taskId);
    return true;
  }
  return false;
}

// ─── 核心编排函数 ─────────────────────────────────────────

/**
 * 启动任务执行。
 *
 * 选择执行器 → 消费事件流 → 推送 SSE → 错误处理
 *
 * @param ctx - 执行上下文
 * @param executorName - 执行器名称（默认 "sequential"）
 */
export async function runTask(
  ctx: ExecutorContext,
  executorName: string = DEFAULT_EXECUTOR,
): Promise<void> {
  const executor = executors[executorName];
  if (!executor) {
    throw new Error(`未知的执行器: ${executorName}`);
  }

  // 防止同一任务重复执行
  if (runningTasks.has(ctx.taskId)) {
    console.warn(`[Orchestrator] 任务 ${ctx.taskId} 已在运行中，跳过重复启动`);
    return;
  }

  const abortController = new AbortController();
  runningTasks.set(ctx.taskId, abortController);

  console.log(
    `[Orchestrator] 启动任务 ${ctx.taskId}，执行器: ${executor.name}，` +
    `模型: ${ctx.config.modelId ?? "default"}`,
  );

  try {
    let eventCount = 0;

    for await (const event of executor.execute(ctx)) {
      // 检查是否被中止
      if (abortController.signal.aborted) {
        console.log(`[Orchestrator] 任务 ${ctx.taskId} 已被中止`);
        emitTaskEvent(ctx.taskId, {
          type: "task:status",
          taskId: ctx.taskId,
          status: "failed",
          timestamp: Date.now(),
        });
        break;
      }

      // 推送事件到 SSE（实时通知前端）
      emitTaskEvent(ctx.taskId, event);

      eventCount++;

      // 定期打印进度日志
      if (eventCount % 10 === 0) {
        console.log(`[Orchestrator] 任务 ${ctx.taskId} 已产出 ${eventCount} 个事件`);
      }
    }

    console.log(
      `[Orchestrator] 任务 ${ctx.taskId} 执行完成，共产出 ${eventCount} 个事件`,
    );
  } catch (error) {
    console.error(`[Orchestrator] 任务 ${ctx.taskId} 执行出错:`, error);

    // 发射错误事件
    emitTaskEvent(ctx.taskId, {
      type: "error",
      taskId: ctx.taskId,
      message: String(error),
      recoverable: false,
      timestamp: Date.now(),
    });

    // 发射任务失败事件
    emitTaskEvent(ctx.taskId, {
      type: "task:status",
      taskId: ctx.taskId,
      status: "failed",
      timestamp: Date.now(),
    });
  } finally {
    runningTasks.delete(ctx.taskId);
  }
}

/**
 * 获取当前运行中的任务数量
 */
export function getRunningTaskCount(): number {
  return runningTasks.size;
}

/**
 * 获取所有运行中的任务 ID
 */
export function getRunningTaskIds(): number[] {
  return Array.from(runningTasks.keys());
}
