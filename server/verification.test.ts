/**
 * Tests for the PRISM Verification Flow
 *
 * Tests the verification type definitions, scoring algorithm,
 * fix request building, and decision logic.
 */

import { describe, it, expect } from "vitest";
import type {
  AcceptanceCriterion,
  AcceptanceCriteriaSet,
  CriterionResult,
  VerificationReport,
  GatePhase,
} from "../shared/verification";
import { GATE_CONFIGS } from "../shared/verification";
import { buildFixRequests, decideAfterFix } from "./verification/fixLoop";

// ─── Type Definitions Tests ───

describe("Verification type definitions", () => {
  it("AcceptanceCriterion has all required fields", () => {
    const criterion: AcceptanceCriterion = {
      id: "AC-001",
      source: "core_feature",
      description: "System should support user authentication",
      verifyMethod: "content_check",
      relatedAgents: ["backend", "frontend"],
      priority: "must",
    };

    expect(criterion.id).toBe("AC-001");
    expect(criterion.source).toBe("core_feature");
    expect(criterion.priority).toBe("must");
    expect(criterion.relatedAgents).toHaveLength(2);
  });

  it("AcceptanceCriteriaSet wraps criteria with metadata", () => {
    const set: AcceptanceCriteriaSet = {
      taskId: 1,
      criteria: [
        {
          id: "AC-001",
          source: "core_feature",
          description: "Test criterion",
          verifyMethod: "content_check",
          relatedAgents: ["backend"],
          priority: "must",
        },
      ],
      generatedAt: Date.now(),
      briefHash: "abc123",
    };

    expect(set.taskId).toBe(1);
    expect(set.criteria).toHaveLength(1);
    expect(set.briefHash).toBe("abc123");
  });

  it("VerificationReport has correct structure", () => {
    const report: VerificationReport = {
      taskId: 1,
      phase: "post_strategy",
      results: [
        {
          criterionId: "AC-001",
          status: "pass",
          reasoning: "Criterion fully met",
        },
      ],
      overallScore: 100,
      gatePass: true,
      gateThreshold: 80,
      verifiedAt: Date.now(),
    };

    expect(report.gatePass).toBe(true);
    expect(report.overallScore).toBe(100);
    expect(report.phase).toBe("post_strategy");
  });
});

// ─── Gate Configuration Tests ───

describe("Gate configurations", () => {
  it("has three gate phases defined", () => {
    const phases: GatePhase[] = ["post_strategy", "post_build", "final"];
    for (const phase of phases) {
      expect(GATE_CONFIGS[phase]).toBeDefined();
      expect(GATE_CONFIGS[phase].threshold).toBeGreaterThan(0);
      expect(GATE_CONFIGS[phase].maxFixRounds).toBeGreaterThan(0);
    }
  });

  it("post_strategy gate includes conductor, researcher, pm, ux", () => {
    const config = GATE_CONFIGS.post_strategy;
    expect(config.relevantAgents).toContain("conductor");
    expect(config.relevantAgents).toContain("researcher");
    expect(config.relevantAgents).toContain("pm");
    expect(config.threshold).toBe(80);
    expect(config.maxFixRounds).toBe(2);
  });

  it("post_build gate includes backend, frontend, devops", () => {
    const config = GATE_CONFIGS.post_build;
    expect(config.relevantAgents).toContain("backend");
    expect(config.relevantAgents).toContain("frontend");
    expect(config.threshold).toBe(75);
  });

  it("final gate has highest threshold and includes all agents", () => {
    const config = GATE_CONFIGS.final;
    expect(config.threshold).toBe(85);
    expect(config.maxFixRounds).toBe(1);
    expect(config.relevantAgents.length).toBeGreaterThanOrEqual(8);
  });
});

// ─── Fix Request Building Tests ───

describe("buildFixRequests", () => {
  const criteria: AcceptanceCriterion[] = [
    {
      id: "AC-001",
      source: "core_feature",
      description: "Auth system",
      verifyMethod: "content_check",
      relatedAgents: ["backend"],
      priority: "must",
    },
    {
      id: "AC-002",
      source: "core_feature",
      description: "Dashboard UI",
      verifyMethod: "content_check",
      relatedAgents: ["frontend"],
      priority: "should",
    },
    {
      id: "AC-003",
      source: "tech_preference",
      description: "Use TypeScript",
      verifyMethod: "structure_check",
      relatedAgents: ["backend", "frontend"],
      priority: "nice_to_have",
    },
  ];

  const agentOutputs: Record<string, string> = {
    backend: "Backend implementation...",
    frontend: "Frontend implementation...",
  };

  it("creates fix requests only for failed/partial criteria", () => {
    const results: CriterionResult[] = [
      { criterionId: "AC-001", status: "fail", reasoning: "Missing auth", fixAgent: "backend", fixSuggestion: "Add auth" },
      { criterionId: "AC-002", status: "pass", reasoning: "Dashboard looks good" },
      { criterionId: "AC-003", status: "partial", reasoning: "Partially typed", fixAgent: "frontend", fixSuggestion: "Add types" },
    ];

    const requests = buildFixRequests(results, criteria, agentOutputs);

    expect(requests).toHaveLength(2);
    expect(requests[0].criterion.id).toBe("AC-001");
    expect(requests[0].targetAgent).toBe("backend");
    expect(requests[1].criterion.id).toBe("AC-003");
    expect(requests[1].targetAgent).toBe("frontend");
  });

  it("returns empty array when all criteria pass", () => {
    const results: CriterionResult[] = [
      { criterionId: "AC-001", status: "pass", reasoning: "OK" },
      { criterionId: "AC-002", status: "pass", reasoning: "OK" },
      { criterionId: "AC-003", status: "not_applicable", reasoning: "N/A" },
    ];

    const requests = buildFixRequests(results, criteria, agentOutputs);
    expect(requests).toHaveLength(0);
  });

  it("uses first relatedAgent as fallback when fixAgent is not specified", () => {
    const results: CriterionResult[] = [
      { criterionId: "AC-001", status: "fail", reasoning: "Missing" },
    ];

    const requests = buildFixRequests(results, criteria, agentOutputs);
    expect(requests).toHaveLength(1);
    expect(requests[0].targetAgent).toBe("backend"); // first relatedAgent
  });
});

// ─── Decision Logic Tests ───

describe("decideAfterFix", () => {
  const criteria: AcceptanceCriterion[] = [
    {
      id: "AC-001",
      source: "core_feature",
      description: "Must-have feature",
      verifyMethod: "content_check",
      relatedAgents: ["backend"],
      priority: "must",
    },
    {
      id: "AC-002",
      source: "core_feature",
      description: "Should-have feature",
      verifyMethod: "content_check",
      relatedAgents: ["frontend"],
      priority: "should",
    },
  ];

  it("returns 'pass' when gate passes after fix", () => {
    const fixedResults: CriterionResult[] = [
      { criterionId: "AC-001", status: "pass", reasoning: "Fixed" },
      { criterionId: "AC-002", status: "pass", reasoning: "Fixed" },
    ];

    const decision = decideAfterFix(60, 90, true, fixedResults, criteria);
    expect(decision).toBe("pass");
  });

  it("returns 'degraded_pass' when score improved and all must criteria pass", () => {
    const fixedResults: CriterionResult[] = [
      { criterionId: "AC-001", status: "pass", reasoning: "Fixed" },
      { criterionId: "AC-002", status: "partial", reasoning: "Partially fixed" },
    ];

    // Score improved (60 → 70) but didn't reach threshold, all must pass
    const decision = decideAfterFix(60, 70, false, fixedResults, criteria);
    expect(decision).toBe("degraded_pass");
  });

  it("returns 'user_intervention' when must criteria still fail", () => {
    const fixedResults: CriterionResult[] = [
      { criterionId: "AC-001", status: "fail", reasoning: "Still broken" },
      { criterionId: "AC-002", status: "pass", reasoning: "OK" },
    ];

    const decision = decideAfterFix(60, 65, false, fixedResults, criteria);
    expect(decision).toBe("user_intervention");
  });

  it("returns 'user_intervention' when score did not improve", () => {
    const fixedResults: CriterionResult[] = [
      { criterionId: "AC-001", status: "pass", reasoning: "OK" },
      { criterionId: "AC-002", status: "fail", reasoning: "Still broken" },
    ];

    // Score didn't improve (60 → 60)
    const decision = decideAfterFix(60, 60, false, fixedResults, criteria);
    expect(decision).toBe("user_intervention");
  });
});

// ─── Verification Event Types Tests ───

describe("Verification event types", () => {
  it("all event types follow verify: prefix convention", () => {
    const eventTypes = [
      "verify:criteria_extracted",
      "verify:gate_start",
      "verify:criterion_result",
      "verify:gate_result",
      "verify:fix_start",
      "verify:fix_result",
    ];

    for (const type of eventTypes) {
      expect(type).toMatch(/^verify:/);
    }
  });
});
