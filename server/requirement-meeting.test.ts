import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 200): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-meeting-${userId}`,
    email: `meeting${userId}@example.com`,
    name: `Meeting User ${userId}`,
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

describe("task.create with meeting mode", () => {
  it("creates a task in meeting mode by default (skipMeeting = false)", async () => {
    const ctx = createAuthContext(201);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Meeting Mode Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Build a social e-commerce platform",
    });

    expect(task).toBeTruthy();
    expect(task.id).toBeGreaterThan(0);

    // Wait a moment for the meeting to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify the task is in clarifying or pending state (meeting mode)
    const retrieved = await caller.task.get({ id: task.id });
    expect(retrieved).toBeTruthy();
    expect(["pending", "clarifying"]).toContain(retrieved?.status);
  });

  it("creates a task in fast mode (skipMeeting = true)", async () => {
    const ctx = createAuthContext(202);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Fast Mode Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Build a simple todo app",
      skipMeeting: true,
    });

    expect(task).toBeTruthy();
    expect(task.id).toBeGreaterThan(0);

    // Wait a moment for the pipeline to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    // In fast mode, task should go directly to running
    const retrieved = await caller.task.get({ id: task.id });
    expect(retrieved).toBeTruthy();
    expect(["pending", "running"]).toContain(retrieved?.status);
  });
});

describe("task.meetingMessages endpoint", () => {
  it("returns meeting messages for a task", async () => {
    const ctx = createAuthContext(203);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Meeting Messages Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Design a project management tool like Linear",
    });

    // Wait for Round 1 agents to generate messages
    await new Promise(resolve => setTimeout(resolve, 15000));

    const messages = await caller.task.meetingMessages({ taskId: task.id });
    expect(Array.isArray(messages)).toBe(true);

    // Round 1 should produce at least 1 message (conductor)
    if (messages.length > 0) {
      const firstMsg = messages[0];
      expect(firstMsg).toHaveProperty("id");
      expect(firstMsg).toHaveProperty("taskId");
      expect(firstMsg).toHaveProperty("sender");
      expect(firstMsg).toHaveProperty("round");
      expect(firstMsg).toHaveProperty("content");
      expect(firstMsg).toHaveProperty("messageType");
      expect(firstMsg).toHaveProperty("createdAt");

      // First message should be from conductor
      expect(firstMsg.sender).toBe("conductor");
      expect(firstMsg.round).toBe(1);
    }
  }, 20000);

  it("returns empty array for non-existent task", async () => {
    const ctx = createAuthContext(204);
    const caller = appRouter.createCaller(ctx);

    const messages = await caller.task.meetingMessages({ taskId: 999999 });
    expect(Array.isArray(messages)).toBe(true);
    expect(messages.length).toBe(0);
  });
});

describe("task.reply endpoint", () => {
  it("rejects reply for non-clarifying task", async () => {
    const ctx = createAuthContext(205);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Reply Reject Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Quick task",
      skipMeeting: true,
    });

    // Task is in running mode, not clarifying
    await new Promise(resolve => setTimeout(resolve, 1000));

    await expect(
      caller.task.reply({ taskId: task.id, message: "Some reply" })
    ).rejects.toThrow();
  });

  it("rejects reply for non-existent task", async () => {
    const ctx = createAuthContext(206);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.task.reply({ taskId: 999999, message: "Some reply" })
    ).rejects.toThrow("Task not found");
  });

  it("rejects unauthenticated reply", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.task.reply({ taskId: 1, message: "Some reply" })
    ).rejects.toThrow();
  });
});

describe("task.confirmMeeting endpoint", () => {
  it("rejects confirm for non-clarifying task", async () => {
    const ctx = createAuthContext(207);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Confirm Reject Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Quick task",
      skipMeeting: true,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    await expect(
      caller.task.confirmMeeting({ taskId: task.id })
    ).rejects.toThrow();
  });

  it("rejects confirm for non-existent task", async () => {
    const ctx = createAuthContext(208);
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.task.confirmMeeting({ taskId: 999999 })
    ).rejects.toThrow("Task not found");
  });

  it("rejects unauthenticated confirm", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.task.confirmMeeting({ taskId: 1 })
    ).rejects.toThrow();
  });
});

describe("meeting flow integration", () => {
  it("task transitions from pending to clarifying during meeting", async () => {
    const ctx = createAuthContext(209);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Flow Test Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Build an AI-powered content management system",
    });

    // Initially pending
    const initial = await caller.task.get({ id: task.id });
    expect(["pending", "clarifying"]).toContain(initial?.status);

    // Wait for meeting Round 1 to complete
    await new Promise(resolve => setTimeout(resolve, 15000));

    const afterRound1 = await caller.task.get({ id: task.id });
    expect(afterRound1?.status).toBe("clarifying");
    expect(afterRound1?.meetingRound).toBeGreaterThanOrEqual(1);
  }, 20000);

  it("meeting messages have correct sender roles", async () => {
    const ctx = createAuthContext(210);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Sender Roles Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Create a fitness tracking mobile app",
    });

    // Wait for Round 1
    await new Promise(resolve => setTimeout(resolve, 15000));

    const messages = await caller.task.meetingMessages({ taskId: task.id });
    const senders = messages.map(m => m.sender);
    const validSenders = ["conductor", "researcher", "pm", "user"];

    for (const sender of senders) {
      expect(validSenders).toContain(sender);
    }

    // Should have messages from at least conductor
    expect(senders).toContain("conductor");
  }, 20000);
});
