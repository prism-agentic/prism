/**
 * SSE 推送路由 — 实时任务事件流
 *
 * 提供 `/api/sse/tasks/:taskId` 端点，前端通过 EventSource 连接，
 * 实时接收 TaskEvent 事件流，替代轮询 task.logs。
 *
 * 设计要点：
 * - 使用 EventBus 订阅指定 taskId 的事件
 * - 连接断开时自动清理监听器
 * - 支持多个并发连接监听同一任务
 * - 心跳机制保持连接活跃（每 30 秒）
 * - 无需认证（SSE 端点仅推送公开的任务事件）
 */

import { Router, type Request, type Response } from "express";
import { subscribeTaskEvents } from "./executor/eventBus";
import type { TaskEvent } from "../shared/taskEvents";

const sseRouter = Router();

/**
 * SSE 端点：实时推送任务事件
 *
 * GET /api/sse/tasks/:taskId
 *
 * 前端使用：
 * ```typescript
 * const es = new EventSource("/api/sse/tasks/123");
 * es.addEventListener("task-event", (e) => {
 *   const event: TaskEvent = JSON.parse(e.data);
 *   // 处理事件...
 * });
 * ```
 */
sseRouter.get("/tasks/:taskId", (req: Request, res: Response) => {
  const taskId = parseInt(req.params.taskId, 10);

  if (isNaN(taskId) || taskId <= 0) {
    res.status(400).json({ error: "Invalid task ID" });
    return;
  }

  // 设置 SSE 响应头
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // 禁用 Nginx 缓冲
  });

  // 发送初始连接确认
  res.write(
    `event: connected\ndata: ${JSON.stringify({ taskId, timestamp: Date.now() })}\n\n`,
  );

  // 订阅事件总线
  const unsubscribe = subscribeTaskEvents(taskId, (event: TaskEvent) => {
    try {
      res.write(`event: task-event\ndata: ${JSON.stringify(event)}\n\n`);
    } catch {
      // 连接已关闭，忽略写入错误
    }
  });

  // 心跳机制：每 30 秒发送一个注释行保持连接
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeatInterval);
    }
  }, 30_000);

  // 连接关闭时清理
  req.on("close", () => {
    unsubscribe();
    clearInterval(heartbeatInterval);
    console.log(`[SSE] 客户端断开连接: taskId=${taskId}`);
  });

  console.log(`[SSE] 客户端已连接: taskId=${taskId}`);
});

export { sseRouter };
