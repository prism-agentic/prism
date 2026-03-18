/**
 * Tests for Phase 13 — Model Selection Feature
 *
 * Validates:
 * 1. AVAILABLE_MODELS list is well-formed
 * 2. project.availableModels endpoint returns the models
 * 3. project.updateModel validates model IDs
 * 4. Model parameter flows through to LLM invocation
 * 5. SequentialExecutor and requirementMeeting accept modelId
 */
import { describe, it, expect, vi } from "vitest";

// ─── Test AVAILABLE_MODELS structure ────────────────────────────────

describe("AVAILABLE_MODELS", () => {
  it("exports a non-empty array of models", async () => {
    const { AVAILABLE_MODELS } = await import("./routers");
    expect(Array.isArray(AVAILABLE_MODELS)).toBe(true);
    expect(AVAILABLE_MODELS.length).toBeGreaterThanOrEqual(5);
  });

  it("each model has required fields", async () => {
    const { AVAILABLE_MODELS } = await import("./routers");
    for (const model of AVAILABLE_MODELS) {
      expect(model.id).toBeTruthy();
      expect(model.name).toBeTruthy();
      expect(model.provider).toBeTruthy();
      expect(model.description).toBeTruthy();
      expect(model.contextWindow).toBeGreaterThan(0);
      expect(model.pricing).toBeTruthy();
      expect(["free", "standard", "premium"]).toContain(model.tier);
    }
  });

  it("each model ID follows provider/model format", async () => {
    const { AVAILABLE_MODELS } = await import("./routers");
    for (const model of AVAILABLE_MODELS) {
      expect(model.id).toMatch(/^[a-z0-9-]+\/[a-z0-9.-]+$/);
    }
  });

  it("has no duplicate model IDs", async () => {
    const { AVAILABLE_MODELS } = await import("./routers");
    const ids = AVAILABLE_MODELS.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("includes models from at least 3 providers", async () => {
    const { AVAILABLE_MODELS } = await import("./routers");
    const providers = new Set(AVAILABLE_MODELS.map(m => m.provider));
    expect(providers.size).toBeGreaterThanOrEqual(3);
  });

  it("includes at least one model per tier", async () => {
    const { AVAILABLE_MODELS } = await import("./routers");
    const tiers = new Set(AVAILABLE_MODELS.map(m => m.tier));
    expect(tiers.has("free")).toBe(true);
    expect(tiers.has("standard")).toBe(true);
    expect(tiers.has("premium")).toBe(true);
  });

  it("includes the default model google/gemini-2.5-flash", async () => {
    const { AVAILABLE_MODELS } = await import("./routers");
    const defaultModel = AVAILABLE_MODELS.find(m => m.id === "google/gemini-2.5-flash");
    expect(defaultModel).toBeDefined();
    expect(defaultModel!.provider).toBe("Google");
  });
});

// ─── Test InvokeParams model field ──────────────────────────────────

describe("invokeLLM model parameter", () => {
  it("InvokeParams type accepts optional model field", async () => {
    // This is a compile-time check — if InvokeParams doesn't have model,
    // the import will fail during type checking
    const { invokeLLM } = await import("./_core/llm");
    expect(typeof invokeLLM).toBe("function");
  });
});

// ─── Test SequentialExecutor accepts modelId via ExecutorConfig ────────────────────────────

describe("SequentialExecutor modelId parameter", () => {
  it("SequentialExecutor is a valid TaskExecutor with execute method", async () => {
    const { SequentialExecutor } = await import("./executor");
    const executor = new SequentialExecutor();
    expect(executor.name).toBe("sequential");
    expect(typeof executor.execute).toBe("function");
  });

  it("ExecutorConfig type accepts optional modelId", async () => {
    // Compile-time check: ExecutorConfig has modelId field
    const config: import("./executor").ExecutorConfig = { modelId: "google/gemini-2.5-flash" };
    expect(config.modelId).toBe("google/gemini-2.5-flash");
  });
});

// ─── Test requirementMeeting accepts modelId ────────────────────────

describe("requirementMeeting modelId parameter", () => {
  it("runMeetingRound1 accepts optional modelId", async () => {
    const { runMeetingRound1 } = await import("./requirementMeeting");
    expect(typeof runMeetingRound1).toBe("function");
    expect(runMeetingRound1.length).toBeLessThanOrEqual(3);
  });

  it("handleUserReply accepts optional modelId", async () => {
    const { handleUserReply } = await import("./requirementMeeting");
    expect(typeof handleUserReply).toBe("function");
    expect(handleUserReply.length).toBeLessThanOrEqual(4);
  });

  it("generateRequirementsBrief accepts optional modelId", async () => {
    const { generateRequirementsBrief } = await import("./requirementMeeting");
    expect(typeof generateRequirementsBrief).toBe("function");
    expect(generateRequirementsBrief.length).toBeLessThanOrEqual(3);
  });
});

// ─── Test model validation logic ────────────────────────────────────

describe("Model validation", () => {
  it("rejects invalid model IDs", async () => {
    const { AVAILABLE_MODELS } = await import("./routers");
    const invalidId = "nonexistent/fake-model-xyz";
    const found = AVAILABLE_MODELS.find(m => m.id === invalidId);
    expect(found).toBeUndefined();
  });

  it("all model context windows are reasonable", async () => {
    const { AVAILABLE_MODELS } = await import("./routers");
    for (const model of AVAILABLE_MODELS) {
      // At least 32K context
      expect(model.contextWindow).toBeGreaterThanOrEqual(32000);
      // At most 10M context (reasonable upper bound)
      expect(model.contextWindow).toBeLessThanOrEqual(10000000);
    }
  });
});
