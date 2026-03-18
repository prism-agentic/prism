# PRISM 核心架构设计文档

**版本：** v1.0
**日期：** 2026-03-15
**作者：** Manus AI

---

## 1. 设计目标

本文档定义 PRISM 多智能体框架的核心接口和数据结构，遵循以下原则：

**渐进式架构** — 从单 Agent 到多 Agent 协作，每一步都是可交付的产品，上层（前端 UI、数据库、API 接口）和下层（Agent 执行逻辑）完全解耦。升级执行引擎时，前端和数据库 schema 不需要改动。

**抽象层隔离** — 定义统一的 `TaskExecutor` 接口和 `TaskEvent` 事件流，所有执行引擎（单 Agent、串行多 Agent、并发 Pipeline）都实现同一接口，前端只消费事件流。

**向前兼容** — 数据库 schema 从一开始就预留 `agentId`、`phase`、`artifactType` 等字段，避免后续迁移。

---

## 2. 现有架构评估

当前项目已具备完整的 Web 应用骨架，以下是现有资产与需要扩展的部分：

| 层级 | 现有资产 | 状态 | 需要扩展 |
|------|---------|------|---------|
| 数据库 | users, projects, tasks, agentLogs, meetingMessages, messageFeedback | 已就绪 | 新增 artifacts 表、扩展 tasks 字段 |
| 后端 API | project CRUD, task CRUD, meeting flow, agent logs | 已就绪 | 新增 artifact API、流式事件推送 |
| 执行引擎 | agentSimulator（LLM 驱动串行 Pipeline）、requirementMeeting（智能路由会议） | 已就绪 | 抽象为 TaskExecutor 接口 |
| 前端 | Landing Page, Dashboard, Workspace, TaskResults, AgentMonitor | 已就绪 | 对接真实数据、展示交付物 |

**关键发现：** 现有的 `agentSimulator.ts` 和 `requirementMeeting.ts` 已经是功能完整的 LLM 驱动引擎，不是模拟数据。它们调用真实的 `invokeLLM` API，具备重试机制和上下文链传递。需要做的不是"从零构建"，而是**将现有引擎封装进抽象层，并补充交付物管理**。

---

## 3. 核心数据模型

### 3.1 实体关系总览

```
User (1) ──→ (N) Project (1) ──→ (N) Task (1) ──→ (N) Artifact
                                       │
                                       ├──→ (N) AgentLog
                                       └──→ (N) MeetingMessage ──→ (0..1) MessageFeedback
```

### 3.2 数据库 Schema 变更

#### 3.2.1 新增表：`artifacts`（交付物）

交付物是 Agent 流水线的最终产出，每个 Task 可以产出多个交付物。这是用户最终"拿到手"的东西。

```typescript
// drizzle/schema.ts — 新增

export const artifacts = mysqlTable("artifacts", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  
  /** 交付物类型：text（Markdown 文档）、code（代码文件）、bundle（多文件打包） */
  type: mysqlEnum("type", ["text", "code", "bundle"]).notNull(),
  
  /** 交付物标题，如 "API 设计文档"、"前端组件代码" */
  title: varchar("title", { length: 200 }).notNull(),
  
  /** 产出该交付物的 Agent 角色 */
  agentRole: varchar("agentRole", { length: 64 }).notNull(),
  
  /** 所属流水线阶段 (0-5) */
  phase: int("phase").default(0),
  
  /** 交付物内容（Markdown 文本或代码字符串） */
  content: longtext("content").notNull(),
  
  /** 文件名（对 code 类型有意义，如 "schema.sql"、"App.tsx"） */
  filename: varchar("filename", { length: 255 }),
  
  /** MIME 类型（如 "text/markdown"、"text/typescript"、"text/html"） */
  mimeType: varchar("mimeType", { length: 128 }),
  
  /** 编程语言（对 code 类型，如 "typescript"、"sql"、"html"） */
  language: varchar("language", { length: 32 }),
  
  /** 排序权重，用于控制交付物展示顺序 */
  sortOrder: int("sortOrder").default(0),
  
  /** 元数据（预留扩展，如 bundle 的文件清单、预览配置等） */
  metadata: json("metadata"),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Artifact = typeof artifacts.$inferSelect;
export type InsertArtifact = typeof artifacts.$inferInsert;
```

#### 3.2.2 扩展现有 `tasks` 表

当前 `tasks` 表的 `result` 字段存储的是 JSON 摘要。建议保留该字段作为轻量摘要，交付物的完整内容存入 `artifacts` 表。无需修改 schema，但需要调整 `result` 的 JSON 结构约定。

**`result` 字段 JSON 结构约定：**

```typescript
interface TaskResult {
  /** 一句话总结 */
  summary: string;
  /** 流水线阶段名称列表 */
  phases: string[];
  /** 参与的 Agent 数量 */
  agentsUsed: number;
  /** 交付物 ID 列表（指向 artifacts 表） */
  artifactIds: number[];
  /** 总耗时（毫秒） */
  totalDurationMs: number;
  /** 各阶段耗时 */
  phaseDurations: Record<string, number>;
}
```

---

## 4. TypeScript 接口定义

### 4.1 核心事件系统（TaskEvent）

这是整个架构的关键抽象。无论底层执行引擎如何变化，前端只消费 `TaskEvent` 流。

```typescript
// shared/taskEvents.ts

/** Agent 身份信息 */
export interface AgentIdentity {
  name: string;        // 显示名，如 "Conductor"
  role: string;        // 角色标识，如 "conductor"
  department: string;  // 部门，如 "specialized"
  avatar?: string;     // 头像 URL（可选）
}

/** 流水线阶段信息 */
export interface PipelinePhase {
  index: number;       // 阶段序号 (0-5)
  name: string;        // 阶段名，如 "Discover"
  agents: string[];    // 该阶段参与的 Agent 角色列表
}

/** ─── 事件类型定义 ─── */

/** 任务状态变更 */
export interface TaskStatusEvent {
  type: "task:status";
  taskId: number;
  status: "pending" | "clarifying" | "confirming" | "running" | "completed" | "failed";
  timestamp: number;   // Unix ms
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
  action: string;      // 当前动作描述，如 "分析与拆解任务"
  timestamp: number;
}

/** Agent 输出内容（支持流式） */
export interface AgentOutputEvent {
  type: "agent:output";
  taskId: number;
  agent: AgentIdentity;
  phase: number;
  content: string;     // Markdown 内容（完整或增量）
  isStreaming: boolean; // true = 增量追加，false = 完整替换
  timestamp: number;
}

/** 会议消息（需求会议阶段） */
export interface MeetingMessageEvent {
  type: "meeting:message";
  taskId: number;
  sender: string;      // "user" | "conductor" | "researcher" | "pm"
  content: string;
  messageType: string; // "analysis" | "research" | "questions" | "reply" | "followup" | "brief"
  round: number;
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
    contentPreview: string;  // 前 200 字符预览
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

/** 所有事件的联合类型 */
export type TaskEvent =
  | TaskStatusEvent
  | PhaseChangeEvent
  | AgentStatusEvent
  | AgentOutputEvent
  | MeetingMessageEvent
  | ArtifactEvent
  | ErrorEvent;
```

### 4.2 任务执行器接口（TaskExecutor）

这是执行引擎的抽象层。所有执行策略都实现这个接口。

```typescript
// server/executor/types.ts

import type { TaskEvent, AgentIdentity, PipelinePhase } from "@shared/taskEvents";

/** 执行器配置 */
export interface ExecutorConfig {
  /** LLM 模型 ID（如 "google/gemini-2.5-flash"） */
  modelId?: string;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 单个 Agent 的最大 token 数 */
  maxTokensPerAgent?: number;
  /** 需求简报（来自会议阶段） */
  requirementsBrief?: string;
}

/** 执行器上下文（注入到每次执行中） */
export interface ExecutorContext {
  taskId: number;
  userId: number;
  projectId: number;
  prompt: string;
  config: ExecutorConfig;
}

/**
 * TaskExecutor — 任务执行器抽象接口
 * 
 * 所有执行引擎（单 Agent、串行多 Agent、并发 Pipeline）都实现此接口。
 * 通过 AsyncGenerator 产出 TaskEvent 流，前端实时消费。
 */
export interface TaskExecutor {
  /** 执行器名称，用于日志和调试 */
  readonly name: string;
  
  /**
   * 执行任务，产出事件流。
   * 
   * @param ctx - 执行上下文
   * @yields TaskEvent - 任务执行过程中的事件
   * 
   * 调用方通过 for-await-of 消费事件：
   * ```
   * for await (const event of executor.execute(ctx)) {
   *   // 持久化事件到数据库
   *   // 推送事件到前端（SSE/WebSocket）
   * }
   * ```
   */
  execute(ctx: ExecutorContext): AsyncGenerator<TaskEvent, void, unknown>;
}
```

### 4.3 Agent 定义注册表

将现有的 Agent 定义从 `agentSimulator.ts` 中的硬编码常量提取为独立的注册表，便于管理和扩展。

```typescript
// server/executor/agentRegistry.ts

import type { AgentIdentity } from "@shared/taskEvents";

/** Agent 完整定义（包含 LLM 提示词） */
export interface AgentDefinition extends AgentIdentity {
  /** 系统提示词 */
  systemPrompt: string;
  /** 该 Agent 需要接收哪些前序 Agent 的上下文 */
  contextFrom: string[];
  /** 最大输出 token 数 */
  maxTokens: number;
}

/** 流水线阶段定义 */
export interface PhaseDefinition {
  index: number;
  name: string;
  agents: string[];  // Agent role 列表
}

/** Agent 注册表 — 集中管理所有 Agent 定义 */
export const AGENT_REGISTRY: Record<string, AgentDefinition> = {
  conductor: {
    name: "Conductor",
    role: "conductor",
    department: "specialized",
    systemPrompt: "...",  // 从现有 AGENT_PROMPTS 迁移
    contextFrom: ["requirements_brief"],
    maxTokens: 4096,
  },
  researcher: {
    name: "Researcher",
    role: "researcher",
    department: "specialized",
    systemPrompt: "...",
    contextFrom: ["conductor", "requirements_brief"],
    maxTokens: 4096,
  },
  pm: {
    name: "Product Manager",
    role: "pm",
    department: "business",
    systemPrompt: "...",
    contextFrom: ["conductor", "researcher", "requirements_brief"],
    maxTokens: 4096,
  },
  ux: {
    name: "UX Designer",
    role: "ux",
    department: "design",
    systemPrompt: "...",
    contextFrom: ["pm", "requirements_brief"],
    maxTokens: 4096,
  },
  backend: {
    name: "Backend Architect",
    role: "backend",
    department: "engineering",
    systemPrompt: "...",
    contextFrom: ["researcher", "pm", "ux", "requirements_brief"],
    maxTokens: 4096,
  },
  frontend: {
    name: "Frontend Developer",
    role: "frontend",
    department: "engineering",
    systemPrompt: "...",
    contextFrom: ["ux", "backend", "requirements_brief"],
    maxTokens: 4096,
  },
  devops: {
    name: "DevOps Engineer",
    role: "devops",
    department: "engineering",
    systemPrompt: "...",
    contextFrom: ["backend", "backend_build"],
    maxTokens: 4096,
  },
  critic: {
    name: "Quality Critic",
    role: "critic",
    department: "specialized",
    systemPrompt: "...",
    contextFrom: ["conductor", "pm", "backend", "frontend", "backend_build", "frontend_build"],
    maxTokens: 4096,
  },
  growth: {
    name: "Growth Hacker",
    role: "growth",
    department: "business",
    systemPrompt: "...",
    contextFrom: ["pm", "critic"],
    maxTokens: 4096,
  },
};

/** 流水线阶段定义 */
export const PIPELINE_PHASES: PhaseDefinition[] = [
  { index: 0, name: "Discover",  agents: ["conductor", "researcher"] },
  { index: 1, name: "Strategy",  agents: ["pm", "ux"] },
  { index: 2, name: "Scaffold",  agents: ["backend", "frontend"] },
  { index: 3, name: "Build",     agents: ["backend", "frontend", "devops"] },
  { index: 4, name: "Harden",    agents: ["critic"] },
  { index: 5, name: "Launch",    agents: ["growth"] },
];
```

---

## 5. tRPC API 设计

### 5.1 新增接口

在现有 `task` router 基础上，新增以下接口：

| 接口 | 类型 | 描述 | 认证 |
|------|------|------|------|
| `task.artifacts` | Query | 获取任务的所有交付物 | Protected |
| `task.artifact` | Query | 获取单个交付物详情（含完整内容） | Protected |
| `task.events` | Subscription/SSE | 实时订阅任务事件流 | Protected |
| `task.interrupt` | Mutation | 用户在执行过程中介入（暂停/修改方向） | Protected |
| `task.retry` | Mutation | 重试失败的任务（从失败的阶段继续） | Protected |

### 5.2 接口详细定义

```typescript
// server/routers.ts — 新增部分

// ─── Artifact 接口 ───

/** 获取任务的所有交付物（轻量列表，不含完整 content） */
"task.artifacts": protectedProcedure
  .input(z.object({ taskId: z.number() }))
  .query(async ({ ctx, input }) => {
    const task = await db.getTaskById(input.taskId, ctx.user.id);
    if (!task) throw new TRPCError({ code: "NOT_FOUND" });
    return db.getTaskArtifacts(input.taskId);
    // 返回: { id, type, title, agentRole, phase, filename, language, sortOrder, createdAt }[]
    // 注意：不返回 content 字段以减少传输量
  }),

/** 获取单个交付物详情（含完整 content） */
"task.artifact": protectedProcedure
  .input(z.object({ id: z.number() }))
  .query(async ({ ctx, input }) => {
    return db.getArtifactById(input.id, ctx.user.id);
    // 返回完整 Artifact 对象，包含 content
  }),

// ─── 实时事件流（SSE） ───

/** 
 * 通过 Server-Sent Events 推送任务事件。
 * 前端通过 EventSource 或 tRPC subscription 消费。
 * 
 * 实现方式：HTTP SSE endpoint（非 tRPC subscription）
 * 路由：GET /api/tasks/:taskId/events
 */

// ─── 用户介入 ───

/** 用户在流水线执行过程中介入 */
"task.interrupt": protectedProcedure
  .input(z.object({
    taskId: z.number(),
    /** 介入类型 */
    action: z.enum(["pause", "resume", "redirect"]),
    /** 用户的修改指令（当 action 为 redirect 时） */
    message: z.string().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    // 通过事件总线通知执行器
    // 执行器在下一个 Agent 执行前检查中断信号
  }),

/** 重试失败的任务 */
"task.retry": protectedProcedure
  .input(z.object({
    taskId: z.number(),
    /** 从哪个阶段重试（默认从失败处继续） */
    fromPhase: z.number().optional(),
  }))
  .mutation(async ({ ctx, input }) => {
    const task = await db.getTaskById(input.taskId, ctx.user.id);
    if (!task) throw new TRPCError({ code: "NOT_FOUND" });
    if (task.status !== "failed") throw new Error("Only failed tasks can be retried");
    // 重置状态并重新启动执行器
  }),
```

### 5.3 SSE 事件推送设计

由于 tRPC 的 subscription 在 HTTP 模式下支持有限，推荐使用独立的 SSE endpoint：

```typescript
// server/sse.ts

import { EventEmitter } from "events";

/** 全局事件总线 — 执行器发布事件，SSE handler 消费 */
export const taskEventBus = new EventEmitter();
taskEventBus.setMaxListeners(100);  // 支持 100 个并发连接

/** 发布事件（执行器调用） */
export function emitTaskEvent(taskId: number, event: TaskEvent) {
  taskEventBus.emit(`task:${taskId}`, event);
}

/** SSE 路由（Express middleware） */
// GET /api/tasks/:taskId/events
export function sseHandler(req: Request, res: Response) {
  const taskId = parseInt(req.params.taskId);
  
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  const listener = (event: TaskEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  taskEventBus.on(`task:${taskId}`, listener);
  
  req.on("close", () => {
    taskEventBus.off(`task:${taskId}`, listener);
  });
}
```

---

## 6. 执行引擎分阶段实现

### 6.1 MVP 第一步：封装现有引擎

将现有的 `agentSimulator.ts` 封装为 `SequentialExecutor`，实现 `TaskExecutor` 接口。**核心改动最小化**，只是在现有逻辑外面包一层事件发射。

```typescript
// server/executor/sequentialExecutor.ts

import type { TaskExecutor, ExecutorContext } from "./types";
import type { TaskEvent } from "@shared/taskEvents";
import { AGENT_REGISTRY, PIPELINE_PHASES } from "./agentRegistry";
import { callAgent } from "./llmHelper";
import { createAgentLog, createArtifact, updateTask } from "../db";

export class SequentialExecutor implements TaskExecutor {
  readonly name = "sequential";

  async *execute(ctx: ExecutorContext): AsyncGenerator<TaskEvent, void, unknown> {
    const agentOutputs: Record<string, string> = {};

    // 注入需求简报
    if (ctx.config.requirementsBrief) {
      agentOutputs["requirements_brief"] = ctx.config.requirementsBrief;
    }

    // 发射任务开始事件
    yield {
      type: "task:status",
      taskId: ctx.taskId,
      status: "running",
      timestamp: Date.now(),
    };

    await updateTask(ctx.taskId, {
      status: "running",
      startedAt: new Date(),
      currentPhase: 0,
    });

    for (const phase of PIPELINE_PHASES) {
      // 发射阶段变更事件
      yield {
        type: "phase:change",
        taskId: ctx.taskId,
        phase: { index: phase.index, name: phase.name, agents: phase.agents },
        timestamp: Date.now(),
      };

      await updateTask(ctx.taskId, { currentPhase: phase.index });

      for (const agentRole of phase.agents) {
        const agentDef = AGENT_REGISTRY[agentRole];
        if (!agentDef) continue;

        const agent = { name: agentDef.name, role: agentDef.role, department: agentDef.department };

        // 发射 Agent 思考中事件
        yield {
          type: "agent:status",
          taskId: ctx.taskId,
          agent,
          phase: phase.index,
          status: "thinking",
          action: getActionLabel(agentRole, phase.index),
          timestamp: Date.now(),
        };

        // 构建上下文
        const previousContext = buildContext(agentOutputs, agentDef.contextFrom);

        // 发射 Agent 工作中事件
        yield {
          type: "agent:status",
          taskId: ctx.taskId,
          agent,
          phase: phase.index,
          status: "working",
          action: getActionLabel(agentRole, phase.index),
          timestamp: Date.now(),
        };

        // 调用 LLM
        const startTime = Date.now();
        const output = await callAgent(agentDef, ctx.prompt, previousContext, ctx.config.modelId);
        const durationMs = Date.now() - startTime;

        // 存储输出
        const outputKey = phase.index === 3 && agentRole !== "devops"
          ? `${agentRole}_build`
          : agentRole;
        agentOutputs[outputKey] = output;

        // 持久化到 agentLogs
        await createAgentLog({
          taskId: ctx.taskId,
          agentName: agentDef.name,
          agentRole: agentDef.role,
          phase: phase.index,
          action: getActionLabel(agentRole, phase.index),
          content: output,
          status: "done",
          durationMs,
        });

        // 发射 Agent 输出事件
        yield {
          type: "agent:output",
          taskId: ctx.taskId,
          agent,
          phase: phase.index,
          content: output,
          isStreaming: false,
          timestamp: Date.now(),
        };

        // 发射 Agent 完成事件
        yield {
          type: "agent:status",
          taskId: ctx.taskId,
          agent,
          phase: phase.index,
          status: "done",
          action: getActionLabel(agentRole, phase.index),
          timestamp: Date.now(),
        };

        // 创建交付物
        const artifact = await createArtifact({
          taskId: ctx.taskId,
          type: "text",
          title: `${agentDef.name} — ${getActionLabel(agentRole, phase.index)}`,
          agentRole: agentDef.role,
          phase: phase.index,
          content: output,
          mimeType: "text/markdown",
          sortOrder: phase.index * 100 + phase.agents.indexOf(agentRole),
        });

        // 发射交付物事件
        yield {
          type: "artifact:created",
          taskId: ctx.taskId,
          artifact: {
            id: artifact.id,
            type: "text",
            title: `${agentDef.name} — ${getActionLabel(agentRole, phase.index)}`,
            agentRole: agentDef.role,
            phase: phase.index,
            contentPreview: output.substring(0, 200),
          },
          timestamp: Date.now(),
        };
      }
    }

    // 发射任务完成事件
    yield {
      type: "task:status",
      taskId: ctx.taskId,
      status: "completed",
      timestamp: Date.now(),
    };
  }
}
```

### 6.2 MVP 第二步：用户介入支持

在 `SequentialExecutor` 的每个 Agent 执行前检查中断信号：

```typescript
// 在 for 循环内，每个 Agent 执行前：
const interrupt = await checkInterrupt(ctx.taskId);
if (interrupt) {
  if (interrupt.action === "pause") {
    yield { type: "task:status", taskId: ctx.taskId, status: "paused", timestamp: Date.now() };
    await waitForResume(ctx.taskId);  // 阻塞直到用户 resume
  } else if (interrupt.action === "redirect") {
    // 将用户的新指令注入上下文
    agentOutputs["user_redirect"] = interrupt.message!;
    ctx.prompt = `${ctx.prompt}\n\n[用户中途修改方向]: ${interrupt.message}`;
  }
}
```

### 6.3 后续：并发 Pipeline 执行器

当验证串行模式可行后，可实现 `ConcurrentExecutor`，在同一阶段内并发执行多个 Agent：

```typescript
// 未来实现 — 同一阶段内的 Agent 并发执行
export class ConcurrentExecutor implements TaskExecutor {
  readonly name = "concurrent";
  
  async *execute(ctx: ExecutorContext): AsyncGenerator<TaskEvent, void, unknown> {
    // 阶段间串行，阶段内并发
    for (const phase of PIPELINE_PHASES) {
      const agentPromises = phase.agents.map(role => 
        this.executeAgent(ctx, role, phase)
      );
      // 使用 Promise.allSettled 并发执行
      // 通过共享的 AsyncGenerator 合并事件流
    }
  }
}
```

---

## 7. 事件消费与前端对接

### 7.1 前端 SSE 客户端

```typescript
// client/src/hooks/useTaskEvents.ts

import { useState, useEffect, useCallback } from "react";
import type { TaskEvent } from "@shared/taskEvents";

export function useTaskEvents(taskId: number | null) {
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!taskId) return;

    const source = new EventSource(`/api/tasks/${taskId}/events`);
    
    source.onopen = () => setConnected(true);
    
    source.onmessage = (e) => {
      const event: TaskEvent = JSON.parse(e.data);
      setEvents(prev => [...prev, event]);
    };

    source.onerror = () => {
      setConnected(false);
      source.close();
    };

    return () => source.close();
  }, [taskId]);

  return { events, connected };
}
```

### 7.2 前端状态派生

从事件流中派生 UI 状态，而不是直接查询数据库：

```typescript
// client/src/hooks/useTaskState.ts

import { useMemo } from "react";
import type { TaskEvent } from "@shared/taskEvents";

export function useTaskState(events: TaskEvent[]) {
  return useMemo(() => {
    let status = "pending";
    let currentPhase = 0;
    const agentStatuses: Record<string, string> = {};
    const artifacts: Array<{ id: number; title: string; type: string }> = [];

    for (const event of events) {
      switch (event.type) {
        case "task:status":
          status = event.status;
          break;
        case "phase:change":
          currentPhase = event.phase.index;
          break;
        case "agent:status":
          agentStatuses[event.agent.role] = event.status;
          break;
        case "artifact:created":
          artifacts.push(event.artifact);
          break;
      }
    }

    return { status, currentPhase, agentStatuses, artifacts };
  }, [events]);
}
```

---

## 8. 执行编排层（Orchestrator）

Orchestrator 是连接 tRPC API 和 TaskExecutor 的中间层，负责：选择执行器、消费事件流、持久化、推送 SSE。

```typescript
// server/executor/orchestrator.ts

import { SequentialExecutor } from "./sequentialExecutor";
import { emitTaskEvent } from "../sse";
import type { ExecutorContext } from "./types";

/** 执行器注册表 — 后续可按策略选择 */
const executors = {
  sequential: new SequentialExecutor(),
  // concurrent: new ConcurrentExecutor(),  // 未来
};

/**
 * 启动任务执行。
 * 选择执行器 → 消费事件流 → 持久化 → SSE 推送
 */
export async function runTask(ctx: ExecutorContext) {
  const executor = executors.sequential;  // MVP 阶段固定使用串行执行器

  try {
    for await (const event of executor.execute(ctx)) {
      // 1. 推送到 SSE（实时通知前端）
      emitTaskEvent(ctx.taskId, event);
      
      // 2. 事件已在执行器内部持久化到数据库
      //    （agentLogs、artifacts、task status 等）
      
      // 3. 可选：写入事件日志表（用于回放和调试）
      // await persistEvent(ctx.taskId, event);
    }
  } catch (error) {
    // 发射错误事件
    emitTaskEvent(ctx.taskId, {
      type: "error",
      taskId: ctx.taskId,
      message: String(error),
      recoverable: false,
      timestamp: Date.now(),
    });
  }
}
```

---

## 9. 迁移计划

### 9.1 从现有代码到新架构的迁移步骤

迁移的核心原则是**增量替换，不破坏现有功能**。

| 步骤 | 工作内容 | 影响范围 | 预估时间 |
|------|---------|---------|---------|
| 1 | 新增 `artifacts` 表，运行 `pnpm db:push` | 数据库 | 10 分钟 |
| 2 | 新增 `db.ts` 中的 artifact CRUD 函数 | 后端 | 30 分钟 |
| 3 | 创建 `shared/taskEvents.ts`，定义事件类型 | 共享类型 | 30 分钟 |
| 4 | 创建 `server/executor/` 目录，提取 Agent 注册表 | 后端 | 1 小时 |
| 5 | 封装 `SequentialExecutor`（从 agentSimulator 迁移逻辑） | 后端 | 2 小时 |
| 6 | 创建 `server/sse.ts` 事件总线和 SSE handler | 后端 | 1 小时 |
| 7 | 创建 Orchestrator，替换 routers.ts 中的直接调用 | 后端 | 1 小时 |
| 8 | 新增 tRPC artifact 接口 | 后端 | 30 分钟 |
| 9 | 前端创建 `useTaskEvents` 和 `useTaskState` hooks | 前端 | 1 小时 |
| 10 | TaskResults 页面对接真实 artifact 数据 | 前端 | 2 小时 |
| **总计** | | | **约 10 小时** |

### 9.2 向后兼容保证

在迁移过程中，现有的 `simulateAgentPipeline` 函数保持不变。新的 `SequentialExecutor` 作为并行实现存在，通过 feature flag 切换：

```typescript
// routers.ts 中的 task.create mutation
if (useNewExecutor) {
  runTask(executorContext).catch(console.error);
} else {
  simulateAgentPipeline(task.id, input.prompt, undefined, modelId).catch(console.error);
}
```

---

## 10. 文件结构规划

```
server/
  executor/
    types.ts              ← TaskExecutor 接口、ExecutorConfig、ExecutorContext
    agentRegistry.ts      ← Agent 定义注册表（从 agentSimulator 提取）
    llmHelper.ts          ← LLM 调用封装（从 agentSimulator 提取）
    sequentialExecutor.ts ← 串行执行器（MVP）
    orchestrator.ts       ← 编排层（选择执行器、消费事件、推送 SSE）
  sse.ts                  ← EventEmitter 事件总线 + SSE HTTP handler
  agentSimulator.ts       ← 保留，向后兼容（逐步废弃）
  requirementMeeting.ts   ← 保留，会议引擎不变
  routers.ts              ← 新增 artifact 接口、interrupt 接口
  db.ts                   ← 新增 artifact CRUD

shared/
  taskEvents.ts           ← TaskEvent 联合类型定义

client/src/
  hooks/
    useTaskEvents.ts      ← SSE 客户端 hook
    useTaskState.ts       ← 从事件流派生 UI 状态
```

---

## 11. 总结

本设计的核心思想是**一个接口（TaskExecutor）、一套事件（TaskEvent）、三步迭代**：

**第一步（MVP）：** 将现有的 `agentSimulator` 封装为 `SequentialExecutor`，新增 `artifacts` 表存储交付物，通过 SSE 推送实时事件。前端消费事件流展示 Agent 工作状态和交付物。改动量最小，风险最低。

**第二步（增强）：** 加入用户介入机制（pause/redirect），完善错误恢复和重试逻辑。

**第三步（进化）：** 实现 `ConcurrentExecutor`，阶段内并发执行。加入质量门控（Agent 输出评分，低于阈值自动重试）。接入进化引擎（L1 微调、L2 蒸馏、L3 架构审查）。

每一步都是可交付的产品，每一步的前端和数据库都不需要重构。
