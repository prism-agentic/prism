import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 100): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-results-${userId}`,
    email: `results${userId}@example.com`,
    name: `Results User ${userId}`,
    loginMethod: "oauth",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUnauthContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("task.get endpoint", () => {
  it("retrieves a specific task by ID", async () => {
    const ctx = createAuthContext(101);
    const caller = appRouter.createCaller(ctx);

    // Create project and task
    const project = await caller.project.create({ name: "Results Test Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Build a landing page",
    });

    // Retrieve the task
    const retrieved = await caller.task.get({ id: task.id });
    expect(retrieved).toBeTruthy();
    expect(retrieved?.prompt).toBe("Build a landing page");
    expect(retrieved?.projectId).toBe(project.id);
  });

  it("returns undefined for non-existent task", async () => {
    const ctx = createAuthContext(102);
    const caller = appRouter.createCaller(ctx);

    const retrieved = await caller.task.get({ id: 999999 });
    expect(retrieved).toBeUndefined();
  });

  it("rejects unauthenticated access to task.get", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.task.get({ id: 1 })).rejects.toThrow();
  });
});

describe("task.logs endpoint for results page", () => {
  it("returns logs for a task in fast mode", async () => {
    const ctx = createAuthContext(103);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Logs Results Project" });
    // Use skipMeeting to go directly to pipeline
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Test task for logs",
      skipMeeting: true,
    });

    // Wait for initial logs to be generated (LLM calls need time)
    await new Promise(resolve => setTimeout(resolve, 15000));

    const logs = await caller.task.logs({ taskId: task.id });
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBeGreaterThanOrEqual(1);

    // Verify log structure
    const firstLog = logs[0];
    expect(firstLog).toHaveProperty("id");
    expect(firstLog).toHaveProperty("taskId");
    expect(firstLog).toHaveProperty("agentName");
    expect(firstLog).toHaveProperty("agentRole");
    expect(firstLog).toHaveProperty("phase");
    expect(firstLog).toHaveProperty("status");
    expect(firstLog).toHaveProperty("content");
    expect(firstLog).toHaveProperty("durationMs");
    expect(firstLog).toHaveProperty("createdAt");
  }, 20000);

  it("returns empty array for task with no logs", async () => {
    const ctx = createAuthContext(104);
    const caller = appRouter.createCaller(ctx);

    // Query logs for non-existent task
    const logs = await caller.task.logs({ taskId: 999999 });
    expect(Array.isArray(logs)).toBe(true);
    expect(logs.length).toBe(0);
  });
});

describe("project-task relationship", () => {
  it("task belongs to correct project", async () => {
    const ctx = createAuthContext(105);
    const caller = appRouter.createCaller(ctx);

    const projectA = await caller.project.create({ name: "Project A" });
    const projectB = await caller.project.create({ name: "Project B" });

    await caller.task.create({ projectId: projectA.id, prompt: "Task for A" });
    await caller.task.create({ projectId: projectB.id, prompt: "Task for B" });

    const tasksA = await caller.task.list({ projectId: projectA.id });
    const tasksB = await caller.task.list({ projectId: projectB.id });

    expect(tasksA.some(t => t.prompt === "Task for A")).toBe(true);
    expect(tasksB.some(t => t.prompt === "Task for B")).toBe(true);

    // Tasks should not leak between projects
    expect(tasksA.some(t => t.prompt === "Task for B")).toBe(false);
    expect(tasksB.some(t => t.prompt === "Task for A")).toBe(false);
  });
});

describe("agent simulator integration", () => {
  it("creates logs with expected agent roles for pipeline in fast mode", async () => {
    const ctx = createAuthContext(106);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Pipeline Test" });
    // Use skipMeeting to go directly to pipeline
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Build a simple API",
      skipMeeting: true,
    });

    // Wait for the conductor agent to start (LLM calls need time)
    await new Promise(resolve => setTimeout(resolve, 15000));

    const logs = await caller.task.logs({ taskId: task.id });
    const roles = [...new Set(logs.map(l => l.agentRole))];

    // Conductor should always be the first agent
    expect(roles).toContain("conductor");

    // Verify log statuses are valid
    const validStatuses = ["thinking", "working", "reviewing", "done", "error"];
    for (const log of logs) {
      expect(validStatuses).toContain(log.status);
    }
  }, 20000);

  it("logs contain phase information in fast mode", async () => {
    const ctx = createAuthContext(107);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Phase Test" });
    // Use skipMeeting to go directly to pipeline
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Design a database schema",
      skipMeeting: true,
    });

    await new Promise(resolve => setTimeout(resolve, 15000));

    const logs = await caller.task.logs({ taskId: task.id });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    // First logs should be phase 0 (Discover)
    const firstLog = logs[0];
    expect(firstLog.phase).toBe(0);
  }, 20000);
});
