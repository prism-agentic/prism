import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(userId = 300): TrpcContext {
  const user: AuthenticatedUser = {
    id: userId,
    openId: `test-tfe-${userId}`,
    email: `tfe${userId}@example.com`,
    name: `TFE User ${userId}`,
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

// ─── Task Templates ─────────────────────────────────────────────────

describe("task.templates endpoint", () => {
  it("returns a list of predefined templates", async () => {
    const ctx = createAuthContext(301);
    const caller = appRouter.createCaller(ctx);

    const templates = await caller.task.templates();
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.length).toBe(3);
  });

  it("each template has required fields", async () => {
    const ctx = createAuthContext(302);
    const caller = appRouter.createCaller(ctx);

    const templates = await caller.task.templates();
    for (const tpl of templates) {
      expect(tpl).toHaveProperty("id");
      expect(tpl).toHaveProperty("name");
      expect(tpl).toHaveProperty("nameZh");
      expect(tpl).toHaveProperty("description");
      expect(tpl).toHaveProperty("descriptionZh");
      expect(tpl).toHaveProperty("prompt");
      expect(tpl).toHaveProperty("suggestedQuestions");
      expect(typeof tpl.id).toBe("string");
      expect(typeof tpl.name).toBe("string");
      expect(typeof tpl.prompt).toBe("string");
      expect(Array.isArray(tpl.suggestedQuestions)).toBe(true);
      expect(tpl.suggestedQuestions.length).toBeGreaterThan(0);
    }
  });

  it("includes SaaS MVP, API Design, and Mobile App templates", async () => {
    const ctx = createAuthContext(303);
    const caller = appRouter.createCaller(ctx);

    const templates = await caller.task.templates();
    const ids = templates.map(t => t.id);
    expect(ids).toContain("saas-mvp");
    expect(ids).toContain("api-design");
    expect(ids).toContain("mobile-app");
  });

  it("is accessible without authentication (public procedure)", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    const templates = await caller.task.templates();
    expect(templates.length).toBe(3);
  });
});

// ─── Feedback Mechanism ─────────────────────────────────────────────

describe("task.feedback endpoint", () => {
  it("rejects unauthenticated feedback", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.task.feedback({ messageId: 1, rating: "satisfied" })
    ).rejects.toThrow();
  });

  it("accepts valid feedback with satisfied rating", async () => {
    const ctx = createAuthContext(304);
    const caller = appRouter.createCaller(ctx);

    // Create a task with meeting to get meeting messages
    const project = await caller.project.create({ name: "Feedback Test Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Build a CRM system for small businesses",
    });

    // Wait for Round 1 messages (LLM calls need time)
    await new Promise(resolve => setTimeout(resolve, 20000));

    const messages = await caller.task.meetingMessages({ taskId: task.id });
    expect(messages.length).toBeGreaterThan(0);
    const agentMsg = messages.find(m => m.sender !== "user");
    expect(agentMsg).toBeTruthy();
    if (agentMsg) {
      const result = await caller.task.feedback({
        messageId: agentMsg.id,
        rating: "satisfied",
      });
      expect(result).toHaveProperty("id");
      expect(result.id).toBeGreaterThan(0);
    }
  }, 30000);

  it("accepts valid feedback with unsatisfied rating", async () => {
    const ctx = createAuthContext(305);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Unsatisfied Feedback Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Build an inventory management system",
    });

    await new Promise(resolve => setTimeout(resolve, 20000));

    const messages = await caller.task.meetingMessages({ taskId: task.id });
    expect(messages.length).toBeGreaterThan(0);
    const agentMsg = messages.find(m => m.sender !== "user");
    expect(agentMsg).toBeTruthy();
    if (agentMsg) {
      const result = await caller.task.feedback({
        messageId: agentMsg.id,
        rating: "unsatisfied",
      });
      expect(result).toHaveProperty("id");
      expect(result.id).toBeGreaterThan(0);
    }
  }, 30000);
});

describe("task.feedbacks endpoint", () => {
  it("returns feedbacks for a task", async () => {
    const ctx = createAuthContext(306);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Feedbacks Query Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Build a recipe sharing platform",
    });

    await new Promise(resolve => setTimeout(resolve, 15000));

    const feedbacks = await caller.task.feedbacks({ taskId: task.id });
    expect(Array.isArray(feedbacks)).toBe(true);
    // Initially no feedbacks
  }, 20000);

  it("rejects unauthenticated feedbacks query", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.task.feedbacks({ taskId: 1 })
    ).rejects.toThrow();
  });
});

// ─── Meeting Export ─────────────────────────────────────────────────

describe("task.exportMeeting endpoint", () => {
  it("returns markdown content for a task with meeting messages", async () => {
    const ctx = createAuthContext(307);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Export Test Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Design a real-time collaboration tool like Figma",
    });

    // Wait for Round 1 messages
    await new Promise(resolve => setTimeout(resolve, 15000));

    const result = await caller.task.exportMeeting({ taskId: task.id });
    expect(result).toHaveProperty("markdown");
    expect(typeof result.markdown).toBe("string");

    // Should contain markdown headers
    expect(result.markdown).toContain("# PRISM");
    // Should contain the task prompt
    expect(result.markdown).toContain("Design a real-time collaboration tool like Figma");
  }, 20000);

  it("returns empty markdown for task with no messages", async () => {
    const ctx = createAuthContext(308);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Empty Export Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Quick test task",
      skipMeeting: true,
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    const result = await caller.task.exportMeeting({ taskId: task.id });
    expect(result).toHaveProperty("markdown");
    // Should still have the header even if no messages
    expect(result.markdown).toContain("# PRISM");
  });

  it("rejects unauthenticated export", async () => {
    const ctx = createUnauthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.task.exportMeeting({ taskId: 1 })
    ).rejects.toThrow();
  });
});

// ─── Template Integration with Task Creation ────────────────────────

describe("task.create with templateId", () => {
  it("creates a task with a valid template ID", async () => {
    const ctx = createAuthContext(309);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Template Task Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Build a SaaS MVP for project management",
      templateId: "saas-mvp",
    });

    expect(task).toBeTruthy();
    expect(task.id).toBeGreaterThan(0);
  });

  it("creates a task with an invalid template ID (should still work)", async () => {
    const ctx = createAuthContext(310);
    const caller = appRouter.createCaller(ctx);

    const project = await caller.project.create({ name: "Invalid Template Project" });
    const task = await caller.task.create({
      projectId: project.id,
      prompt: "Build something custom",
      templateId: "non-existent-template",
    });

    expect(task).toBeTruthy();
    expect(task.id).toBeGreaterThan(0);
  });
});
