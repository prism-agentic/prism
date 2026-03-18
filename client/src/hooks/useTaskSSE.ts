/**
 * useTaskSSE — 实时任务事件 SSE 客户端 Hook
 *
 * 通过 EventSource 连接 `/api/sse/tasks/:taskId`，
 * 实时接收 TaskEvent 事件流，替代轮询 task.logs。
 *
 * 功能：
 * - 自动连接/断开 SSE
 * - 按事件类型分发到回调
 * - 维护本地事件日志（用于渲染）
 * - 自动重连机制
 * - 连接状态管理
 */

import { useEffect, useRef, useCallback, useState } from "react";
import type {
  TaskEvent,
  TaskStatusEvent,
  PhaseChangeEvent,
  AgentStatusEvent,
  AgentOutputEvent,
  MeetingMessageEvent,
  GateEvent,
  ArtifactEvent,
  ErrorEvent,
} from "../../../shared/taskEvents";

// ─── 连接状态 ─────────────────────────────────────────

export type SSEConnectionState = "disconnected" | "connecting" | "connected" | "error";

// ─── Hook 配置 ─────────────────────────────────────────

export interface UseTaskSSEOptions {
  /** 任务 ID（null/undefined 时不连接） */
  taskId: number | null | undefined;
  /** 是否启用 SSE（默认 true） */
  enabled?: boolean;
  /** 最大重连次数（默认 5） */
  maxRetries?: number;
  /** 重连延迟基数（毫秒，默认 1000） */
  retryDelayMs?: number;

  // ─── 事件回调 ─────────────────────────────────────────
  onTaskStatus?: (event: TaskStatusEvent) => void;
  onPhaseChange?: (event: PhaseChangeEvent) => void;
  onAgentStatus?: (event: AgentStatusEvent) => void;
  onAgentOutput?: (event: AgentOutputEvent) => void;
  onMeetingMessage?: (event: MeetingMessageEvent) => void;
  onGateStatus?: (event: GateEvent) => void;
  onArtifact?: (event: ArtifactEvent) => void;
  onError?: (event: ErrorEvent) => void;
  /** 通用事件回调（所有事件都会触发） */
  onEvent?: (event: TaskEvent) => void;
}

// ─── Hook 返回值 ─────────────────────────────────────────

export interface UseTaskSSEReturn {
  /** 当前连接状态 */
  connectionState: SSEConnectionState;
  /** 累积的事件日志 */
  events: TaskEvent[];
  /** 手动清除事件日志 */
  clearEvents: () => void;
  /** 手动重连 */
  reconnect: () => void;
}

// ─── Hook 实现 ─────────────────────────────────────────

export function useTaskSSE(options: UseTaskSSEOptions): UseTaskSSEReturn {
  const {
    taskId,
    enabled = true,
    maxRetries = 5,
    retryDelayMs = 1000,
  } = options;

  const [connectionState, setConnectionState] = useState<SSEConnectionState>("disconnected");
  const [events, setEvents] = useState<TaskEvent[]>([]);

  // 使用 ref 保存回调，避免 effect 重新触发
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 分发事件到对应回调 */
  const dispatchEvent = useCallback((event: TaskEvent) => {
    const opts = optionsRef.current;
    opts.onEvent?.(event);

    switch (event.type) {
      case "task:status":
        opts.onTaskStatus?.(event);
        break;
      case "phase:change":
        opts.onPhaseChange?.(event);
        break;
      case "agent:status":
        opts.onAgentStatus?.(event);
        break;
      case "agent:output":
        opts.onAgentOutput?.(event);
        break;
      case "meeting:message":
        opts.onMeetingMessage?.(event);
        break;
      case "gate:status":
        opts.onGateStatus?.(event);
        break;
      case "artifact:created":
        opts.onArtifact?.(event);
        break;
      case "error":
        opts.onError?.(event);
        break;
    }
  }, []);

  /** 建立 SSE 连接 */
  const connect = useCallback(() => {
    if (!taskId || !enabled) return;

    // 清理旧连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    setConnectionState("connecting");

    const es = new EventSource(`/api/sse/tasks/${taskId}`);
    eventSourceRef.current = es;

    // 连接成功
    es.addEventListener("connected", () => {
      setConnectionState("connected");
      retryCountRef.current = 0;
      console.log(`[SSE] 已连接: taskId=${taskId}`);
    });

    // 接收任务事件
    es.addEventListener("task-event", (e: MessageEvent) => {
      try {
        const event: TaskEvent = JSON.parse(e.data);
        setEvents(prev => [...prev, event]);
        dispatchEvent(event);

        // 任务完成或失败时，自动断开 SSE
        if (event.type === "task:status" && (event.status === "completed" || event.status === "failed")) {
          console.log(`[SSE] 任务 ${taskId} 已${event.status === "completed" ? "完成" : "失败"}，断开连接`);
          es.close();
          eventSourceRef.current = null;
          setConnectionState("disconnected");
        }
      } catch (err) {
        console.error("[SSE] 解析事件失败:", err);
      }
    });

    // 连接错误 → 自动重连
    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;

      if (retryCountRef.current < maxRetries) {
        const delay = retryDelayMs * Math.pow(2, retryCountRef.current);
        retryCountRef.current++;
        setConnectionState("connecting");
        console.log(`[SSE] 连接断开，${delay}ms 后重连 (${retryCountRef.current}/${maxRetries})`);
        retryTimerRef.current = setTimeout(connect, delay);
      } else {
        setConnectionState("error");
        console.error(`[SSE] 达到最大重连次数 (${maxRetries})，停止重连`);
      }
    };
  }, [taskId, enabled, maxRetries, retryDelayMs, dispatchEvent]);

  /** 手动清除事件 */
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);

  /** 手动重连 */
  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  // 当 taskId 变化时重新连接
  useEffect(() => {
    if (!taskId || !enabled) {
      // 清理
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      setConnectionState("disconnected");
      return;
    }

    // 清除旧事件
    setEvents([]);
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [taskId, enabled, connect]);

  return {
    connectionState,
    events,
    clearEvents,
    reconnect,
  };
}

// ─── 导出类型 ─────────────────────────────────────────

export type { TaskEvent } from "../../../shared/taskEvents";
