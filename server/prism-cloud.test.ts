import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 1): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-user-${userId}`,
    email: `test${userId}@example.com`,
    name: `Test User ${userId}`,
    loginMethod: "manus",
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

describe("project CRUD", () => {
  it("creates a project and retrieves it", async () => {
    const ctx = createAuthContext(1);
    const caller = appRouter.createCaller(ctx);

    const created = await caller.project.create({
      name: "Test Project",
      description: "A test project",
      template: "saas-mvp",
    });

    expect(created).toHaveProperty("id");
    expect(typeof created.id).toBe("number");

    const project = await caller.project.get({ id: created.id });
    expect(project).toBeTruthy();
    expect(project?.name).toBe("Test Project");
    expect(project?.template).toBe("saas-mvp");
  });

  it("lists user projects", async () => {
    const ctx = createAuthContext(2);
    const caller = appRouter.createCaller(ctx);

    await caller.project.create({ name: "Project A" });
    await caller.project.create({ name: "Project B" });

    const projects = await caller.project.list();
    expect(projects.length).toBeGreaterThanOrEqual(2);
  });

  it("updates a project", async () => {
    const ctx = createAuthContext(3);
    const caller = appRouter.createCaller(ctx);

    const created = await caller.project.create({ name: "Old Name" });
    await caller.project.update({ id: created.id, name: "New Name" });

    const updated = await caller.project.get({ id: created.id });
    expect(updated?.name).toBe("New Name");
  });

  it("deletes a project", async () => {
    const ctx = createAuthContext(4);
    const caller = appRouter.createCaller(ctx);

    const created = await caller.project.create({ name: "To Delete" });
    const result = await caller.project.delete({ id: created.id });
    expect(result).toEqual({ success: true });

    const deleted = await caller.project.get({ id: created.id });
    expect(deleted).toBeUndefined();
  });

  it("rejects unauthenticated access", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.project.list()).rejects.toThrow();
  });
});

describe("task management", () => {
  it("creates a task and starts simulation", async () => {
    const ctx = createAuthContext(5);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Task Test Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Build a test app",
    });

    expect(task).toHaveProperty("id");
    expect(typeof task.id).toBe("number");
  });

  it("lists tasks for a project", async () => {
    const ctx = createAuthContext(6);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Task List Project" });
    await caller.task.create({ projectId: project.id, prompt: "Task 1" });

    const tasks = await caller.task.list({ projectId: project.id });
    expect(tasks.length).toBeGreaterThanOrEqual(1);
    expect(tasks[0].prompt).toBe("Task 1");
  });

  it("retrieves task logs", async () => {
    const ctx = createAuthContext(7);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Logs Project" });
    const task = await caller.task.create({ projectId: project.id, prompt: "Test logs" });

    // Wait a bit for simulator to start generating logs
    await new Promise(resolve => setTimeout(resolve, 2000));

    const logs = await caller.task.logs({ taskId: task.id });
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0]).toHaveProperty("agentName");
    expect(logs[0]).toHaveProperty("agentRole");
    expect(logs[0]).toHaveProperty("phase");
    expect(logs[0]).toHaveProperty("status");
  });
});

describe("agent simulator", () => {
  it("generates logs with correct agent roles", async () => {
    const ctx = createAuthContext(8);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Simulator Project" });
    const task = await caller.task.create({ projectId: project.id, prompt: "Simulate agents" });

    // Wait for first agent to produce logs
    await new Promise(resolve => setTimeout(resolve, 3000));

    const logs = await caller.task.logs({ taskId: task.id });
    const roles = [...new Set(logs.map(l => l.agentRole))];

    // At minimum, conductor should have started
    expect(roles).toContain("conductor");
  });
});
