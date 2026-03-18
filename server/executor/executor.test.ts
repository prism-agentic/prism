/**
 * TaskExecutor 抽象层测试
 *
 * 测试内容：
 * 1. Agent 注册表完整性
 * 2. 流水线阶段定义
 * 3. 操作标签映射
 * 4. 上下文构建
 * 5. 事件总线发布/订阅
 * 6. SequentialExecutor 接口合规性
 * 7. Orchestrator 任务管理
 * 8. TaskEvent 类型完整性
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  AGENT_REGISTRY,
  PIPELINE_PHASES,
  AGENT_LIST,
  getActionLabel,
  buildAgentContext,
  type AgentDefinition,
  type PhaseDefinition,
} from "./agentRegistry";
import {
  emitTaskEvent,
  subscribeTaskEvents,
  getListenerCount,
} from "./eventBus";
import { SequentialExecutor } from "./sequentialExecutor";
import { ConcurrentExecutor } from "./concurrentExecutor";
import {
  isTaskRunning,
  getRunningTaskCount,
  getRunningTaskIds,
  getAvailableExecutors,
} from "./orchestrator";
import type { TaskEvent } from "../../shared/taskEvents";
import type { TaskExecutor, ExecutorContext } from "./types";

// ─── Agent 注册表测试 ─────────────────────────────────────────

describe("Agent Registry", () => {
  it("should have all 9 agents defined", () => {
    const expectedRoles = [
      "conductor", "researcher", "pm", "ux",
      "backend", "frontend", "devops", "critic", "growth",
    ];
    for (const role of expectedRoles) {
      expect(AGENT_REGISTRY[role]).toBeDefined();
      expect(AGENT_REGISTRY[role].role).toBe(role);
    }
  });

  it("each agent should have required fields", () => {
    for (const [role, agent] of Object.entries(AGENT_REGISTRY)) {
      expect(agent.name).toBeTruthy();
      expect(agent.role).toBe(role);
      expect(agent.department).toBeTruthy();
      expect(agent.systemPrompt).toBeTruthy();
      expect(agent.systemPrompt.length).toBeGreaterThan(50);
      expect(Array.isArray(agent.contextFrom)).toBe(true);
      expect(agent.maxTokens).toBeGreaterThan(0);
    }
  });

  it("AGENT_LIST should match AGENT_REGISTRY entries", () => {
    expect(AGENT_LIST.length).toBe(Object.keys(AGENT_REGISTRY).length);
    for (const agent of AGENT_LIST) {
      expect(AGENT_REGISTRY[agent.role]).toBeDefined();
      expect(AGENT_REGISTRY[agent.role].name).toBe(agent.name);
    }
  });

  it("each agent should have a valid department", () => {
    const validDepartments = ["specialized", "business", "design", "engineering"];
    for (const agent of Object.values(AGENT_REGISTRY)) {
      expect(validDepartments).toContain(agent.department);
    }
  });

  it("contextFrom should only reference valid keys", () => {
    const validKeys = [
      ...Object.keys(AGENT_REGISTRY),
      "requirements_brief",
      "backend_build",
      "frontend_build",
    ];
    for (const agent of Object.values(AGENT_REGISTRY)) {
      for (const key of agent.contextFrom) {
        expect(validKeys).toContain(key);
      }
    }
  });
});

// ─── 流水线阶段测试 ─────────────────────────────────────────

describe("Pipeline Phases", () => {
  it("should have 6 phases", () => {
    expect(PIPELINE_PHASES.length).toBe(6);
  });

  it("phases should be in correct order", () => {
    const expectedNames = ["Discover", "Strategy", "Scaffold", "Build", "Harden", "Launch"];
    for (let i = 0; i < PIPELINE_PHASES.length; i++) {
      expect(PIPELINE_PHASES[i].index).toBe(i);
      expect(PIPELINE_PHASES[i].name).toBe(expectedNames[i]);
    }
  });

  it("all phase agents should exist in registry", () => {
    for (const phase of PIPELINE_PHASES) {
      for (const agentRole of phase.agents) {
        expect(AGENT_REGISTRY[agentRole]).toBeDefined();
      }
    }
  });

  it("every agent should appear in at least one phase", () => {
    const allPhaseAgents = new Set(PIPELINE_PHASES.flatMap(p => p.agents));
    for (const role of Object.keys(AGENT_REGISTRY)) {
      expect(allPhaseAgents.has(role)).toBe(true);
    }
  });
});

// ─── 操作标签测试 ─────────────────────────────────────────

describe("getActionLabel", () => {
  it("should return correct labels for known role-phase combinations", () => {
    expect(getActionLabel("conductor", 0)).toBe("分析与拆解任务");
    expect(getActionLabel("researcher", 0)).toBe("调研技术与市场");
    expect(getActionLabel("pm", 1)).toBe("定义需求与用户故事");
    expect(getActionLabel("critic", 4)).toBe("审查质量与安全");
    expect(getActionLabel("growth", 5)).toBe("规划发布与增长策略");
  });

  it("should return fallback for unknown combinations", () => {
    expect(getActionLabel("conductor", 5)).toBe("处理中");
    expect(getActionLabel("unknown_role", 0)).toBe("处理中");
  });

  it("backend should have multiple phase labels", () => {
    expect(getActionLabel("backend", 2)).toBe("设计系统架构");
    expect(getActionLabel("backend", 3)).toBe("实现核心服务");
  });
});

// ─── 上下文构建测试 ─────────────────────────────────────────

describe("buildAgentContext", () => {
  const mockOutputs: Record<string, string> = {
    requirements_brief: "需求简报内容",
    conductor: "指挥官的分析结果",
    researcher: "调研员的报告",
    pm: "产品经理的需求文档",
  };

  it("should build context for researcher (depends on conductor + requirements_brief)", () => {
    const context = buildAgentContext(mockOutputs, "researcher");
    expect(context).toContain("指挥官的分析结果");
    expect(context).toContain("需求简报内容");
  });

  it("should build context for pm (depends on conductor + researcher + requirements_brief)", () => {
    const context = buildAgentContext(mockOutputs, "pm");
    expect(context).toContain("指挥官的分析结果");
    expect(context).toContain("调研员的报告");
    expect(context).toContain("需求简报内容");
  });

  it("should return empty string for unknown agent", () => {
    const context = buildAgentContext(mockOutputs, "unknown");
    expect(context).toBe("");
  });

  it("should skip missing context keys gracefully", () => {
    const partialOutputs = { requirements_brief: "简报" };
    const context = buildAgentContext(partialOutputs, "pm");
    expect(context).toContain("简报");
    expect(context).not.toContain("指挥官");
  });
});

// ─── 事件总线测试 ─────────────────────────────────────────

describe("EventBus", () => {
  it("should emit and receive events", () => {
    const received: TaskEvent[] = [];
    const unsubscribe = subscribeTaskEvents(999, (event) => {
      received.push(event);
    });

    const testEvent: TaskEvent = {
      type: "task:status",
      taskId: 999,
      status: "running",
      timestamp: Date.now(),
    };

    emitTaskEvent(999, testEvent);

    expect(received.length).toBe(1);
    expect(received[0].type).toBe("task:status");
    expect((received[0] as any).status).toBe("running");

    unsubscribe();
  });

  it("should not receive events after unsubscribe", () => {
    const received: TaskEvent[] = [];
    const unsubscribe = subscribeTaskEvents(998, (event) => {
      received.push(event);
    });

    unsubscribe();

    emitTaskEvent(998, {
      type: "task:status",
      taskId: 998,
      status: "running",
      timestamp: Date.now(),
    });

    expect(received.length).toBe(0);
  });

  it("should support multiple listeners on same task", () => {
    const received1: TaskEvent[] = [];
    const received2: TaskEvent[] = [];

    const unsub1 = subscribeTaskEvents(997, (e) => received1.push(e));
    const unsub2 = subscribeTaskEvents(997, (e) => received2.push(e));

    emitTaskEvent(997, {
      type: "task:status",
      taskId: 997,
      status: "completed",
      timestamp: Date.now(),
    });

    expect(received1.length).toBe(1);
    expect(received2.length).toBe(1);

    unsub1();
    unsub2();
  });

  it("should isolate events between different tasks", () => {
    const received: TaskEvent[] = [];
    const unsubscribe = subscribeTaskEvents(996, (e) => received.push(e));

    emitTaskEvent(995, {
      type: "task:status",
      taskId: 995,
      status: "running",
      timestamp: Date.now(),
    });

    expect(received.length).toBe(0);

    unsubscribe();
  });

  it("should track listener count", () => {
    const unsub1 = subscribeTaskEvents(994, () => {});
    const unsub2 = subscribeTaskEvents(994, () => {});

    expect(getListenerCount(994)).toBe(2);

    unsub1();
    expect(getListenerCount(994)).toBe(1);

    unsub2();
    expect(getListenerCount(994)).toBe(0);
  });
});

// ─── SequentialExecutor 接口测试 ─────────────────────────────

describe("SequentialExecutor", () => {
  it("should implement TaskExecutor interface", () => {
    const executor = new SequentialExecutor();
    expect(executor.name).toBe("sequential");
    expect(typeof executor.execute).toBe("function");
  });

  it("should satisfy TaskExecutor type constraint", () => {
    // This is a compile-time check — if it compiles, the interface is satisfied
    const executor: TaskExecutor = new SequentialExecutor();
    expect(executor.name).toBeTruthy();
  });
});

/// ─── ConcurrentExecutor 接口测试 ───────────────────────────────

describe("ConcurrentExecutor", () => {
  it("should implement TaskExecutor interface", () => {
    const executor = new ConcurrentExecutor();
    expect(executor.name).toBe("concurrent");
    expect(typeof executor.execute).toBe("function");
  });

  it("should satisfy TaskExecutor type constraint", () => {
    const executor: TaskExecutor = new ConcurrentExecutor();
    expect(executor.name).toBeTruthy();
  });

  it("should have a different name than SequentialExecutor", () => {
    const seq = new SequentialExecutor();
    const con = new ConcurrentExecutor();
    expect(seq.name).not.toBe(con.name);
  });
});

// ─── Orchestrator 测试 ─────────────────────────────────

describe("Orchestrator", () => {
  it("should report no running tasks initially", () => {
    expect(getRunningTaskCount()).toBe(0);
    expect(getRunningTaskIds()).toEqual([]);
  });

  it("isTaskRunning should return false for non-running tasks", () => {
    expect(isTaskRunning(12345)).toBe(false);
  });

  it("getAvailableExecutors should list all executors", () => {
    const executors = getAvailableExecutors();
    expect(executors.length).toBe(3);
    const names = executors.map(e => e.name);
    expect(names).toContain("sequential");
    expect(names).toContain("concurrent");
    expect(names).toContain("auto");
  });

  it("each executor should have a description", () => {
    const executors = getAvailableExecutors();
    for (const exec of executors) {
      expect(exec.name).toBeTruthy();
      expect(exec.description).toBeTruthy();
      expect(exec.description.length).toBeGreaterThan(5);
    }
  });
});

// ─── TaskEvent 类型测试 ─────────────────────────────────────

describe("TaskEvent types", () => {
  it("should create valid task:status event", () => {
    const event: TaskEvent = {
      type: "task:status",
      taskId: 1,
      status: "running",
      timestamp: Date.now(),
    };
    expect(event.type).toBe("task:status");
  });

  it("should create valid phase:change event", () => {
    const event: TaskEvent = {
      type: "phase:change",
      taskId: 1,
      phase: { index: 0, name: "Discover", agents: ["conductor", "researcher"] },
      timestamp: Date.now(),
    };
    expect(event.type).toBe("phase:change");
  });

  it("should create valid agent:status event", () => {
    const event: TaskEvent = {
      type: "agent:status",
      taskId: 1,
      agent: { name: "Conductor", role: "conductor", department: "specialized" },
      phase: 0,
      status: "thinking",
      action: "分析与拆解任务",
      timestamp: Date.now(),
    };
    expect(event.type).toBe("agent:status");
  });

  it("should create valid agent:output event", () => {
    const event: TaskEvent = {
      type: "agent:output",
      taskId: 1,
      agent: { name: "Conductor", role: "conductor", department: "specialized" },
      phase: 0,
      content: "分析结果...",
      isStreaming: false,
      timestamp: Date.now(),
    };
    expect(event.type).toBe("agent:output");
  });

  it("should create valid gate:status event", () => {
    const event: TaskEvent = {
      type: "gate:status",
      taskId: 1,
      gate: "post_strategy",
      phase: 1,
      status: "passed",
      score: 85,
      threshold: 80,
      message: "门控通过",
      timestamp: Date.now(),
    };
    expect(event.type).toBe("gate:status");
  });

  it("should create valid error event", () => {
    const event: TaskEvent = {
      type: "error",
      taskId: 1,
      message: "Something went wrong",
      recoverable: false,
      timestamp: Date.now(),
    };
    expect(event.type).toBe("error");
  });
});
