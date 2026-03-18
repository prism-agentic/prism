/**
 * 事件总线 — 连接执行器和 SSE 推送
 *
 * 使用 Node.js EventEmitter 实现发布/订阅模式。
 * 执行器（Orchestrator）发布 TaskEvent，SSE handler 订阅并推送给前端。
 *
 * 设计考虑：
 * - 每个 taskId 有独立的事件通道（`task:${taskId}`）
 * - 支持多个并发连接监听同一任务
 * - 连接断开时自动清理监听器
 */

import { EventEmitter } from "events";
import type { TaskEvent } from "../../shared/taskEvents";

/** 全局事件总线 */
const taskEventBus = new EventEmitter();
taskEventBus.setMaxListeners(100); // 支持 100 个并发连接

/**
 * 发布任务事件
 *
 * @param taskId - 任务 ID
 * @param event - 要发布的事件
 */
export function emitTaskEvent(taskId: number, event: TaskEvent): void {
  taskEventBus.emit(`task:${taskId}`, event);
}

/**
 * 订阅任务事件
 *
 * @param taskId - 任务 ID
 * @param listener - 事件监听器
 * @returns 取消订阅函数
 */
export function subscribeTaskEvents(
  taskId: number,
  listener: (event: TaskEvent) => void,
): () => void {
  const channel = `task:${taskId}`;
  taskEventBus.on(channel, listener);
  return () => {
    taskEventBus.off(channel, listener);
  };
}

/**
 * 获取指定任务的监听器数量（用于调试）
 */
export function getListenerCount(taskId: number): number {
  return taskEventBus.listenerCount(`task:${taskId}`);
}

export { taskEventBus };
