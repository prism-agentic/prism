import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 300): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-brief-${userId}`,
    email: `brief${userId}@example.com`,
    name: `Brief User ${userId}`,
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

// ─── endMeeting endpoint tests ──────────────────────────────────────

describe("task.endMeeting endpoint", () => {
  it("rejects endMeeting for non-existent task", async () => {
    const ctx = createAuthContext(301);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.task.endMeeting({ taskId: 999999 })
    ).rejects.toThrow("Task not found");
  });

  it("rejects endMeeting for non-clarifying task", async () => {
    const ctx = createAuthContext(302);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "EndMeeting Reject Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Quick task for endMeeting test",
      skipMeeting: true,
    });

    // Task is in running mode, not clarifying
    await new Promise(resolve => setTimeout(resolve, 1000));

    await expect(
      caller.task.endMeeting({ taskId: task.id })
    ).rejects.toThrow();
  });

  it("rejects unauthenticated endMeeting", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.task.endMeeting({ taskId: 1 })
    ).rejects.toThrow();
  });
});

// ─── approveBrief endpoint tests ────────────────────────────────────

describe("task.approveBrief endpoint", () => {
  it("rejects approveBrief for non-existent task", async () => {
    const ctx = createAuthContext(303);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.task.approveBrief({ taskId: 999999 })
    ).rejects.toThrow("Task not found");
  });

  it("rejects approveBrief for non-confirming task (running)", async () => {
    const ctx = createAuthContext(304);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "ApproveBrief Reject Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Quick task for approveBrief test",
      skipMeeting: true,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    await expect(
      caller.task.approveBrief({ taskId: task.id })
    ).rejects.toThrow();
  });

  it("rejects unauthenticated approveBrief", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.task.approveBrief({ taskId: 1 })
    ).rejects.toThrow();
  });
});

// ─── updateBrief endpoint tests ─────────────────────────────────────

describe("task.updateBrief endpoint", () => {
  it("rejects updateBrief for non-existent task", async () => {
    const ctx = createAuthContext(305);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.task.updateBrief({ taskId: 999999, brief: "Updated brief" })
    ).rejects.toThrow("Task not found");
  });

  it("rejects updateBrief for non-confirming task", async () => {
    const ctx = createAuthContext(306);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "UpdateBrief Reject Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Quick task for updateBrief test",
      skipMeeting: true,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    await expect(
      caller.task.updateBrief({ taskId: task.id, brief: "Updated brief" })
    ).rejects.toThrow();
  });

  it("rejects empty brief", async () => {
    const ctx = createAuthContext(307);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.task.updateBrief({ taskId: 1, brief: "" })
    ).rejects.toThrow();
  });

  it("rejects unauthenticated updateBrief", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.task.updateBrief({ taskId: 1, brief: "Updated brief" })
    ).rejects.toThrow();
  });
});

// ─── returnToMeeting endpoint tests ─────────────────────────────────

describe("task.returnToMeeting endpoint", () => {
  it("rejects returnToMeeting for non-existent task", async () => {
    const ctx = createAuthContext(308);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.task.returnToMeeting({ taskId: 999999 })
    ).rejects.toThrow("Task not found");
  });

  it("rejects returnToMeeting for non-confirming task", async () => {
    const ctx = createAuthContext(309);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "ReturnToMeeting Reject Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Quick task for returnToMeeting test",
      skipMeeting: true,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    await expect(
      caller.task.returnToMeeting({ taskId: task.id })
    ).rejects.toThrow();
  });

  it("rejects unauthenticated returnToMeeting", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.task.returnToMeeting({ taskId: 1 })
    ).rejects.toThrow();
  });
});

// ─── Status flow validation ─────────────────────────────────────────

describe("confirmation flow status transitions", () => {
  it("task templates endpoint still works", async () => {
    const ctx = createAuthContext(310);
    const caller = appRouter.createCaller(ctx);

    const templates = await caller.task.templates();
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBe(3);
    expect(templates.map(t => t.id)).toEqual(["saas-mvp", "api-design", "mobile-app"]);
  });

  it("confirmMeeting legacy endpoint still works (backward compat)", async () => {
    const ctx = createAuthContext(311);
    const caller = appRouter.createCaller(ctx);

    // Should reject for non-existent task
    await expect(
      caller.task.confirmMeeting({ taskId: 999999 })
    ).rejects.toThrow("Task not found");
  });

  it("meeting mode task starts in pending/clarifying", async () => {
    const ctx = createAuthContext(312);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Status Flow Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Build a CRM system for small businesses",
    });

    const retrieved = await caller.task.get({ id: task.id });
    expect(retrieved).toBeTruthy();
    expect(["pending", "clarifying"]).toContain(retrieved?.status);
  });

  it("fast mode task goes directly to running", async () => {
    const ctx = createAuthContext(313);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Fast Mode Status Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Build a simple calculator",
      skipMeeting: true,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    const retrieved = await caller.task.get({ id: task.id });
    expect(retrieved).toBeTruthy();
    expect(["pending", "running"]).toContain(retrieved?.status);
  });
});
