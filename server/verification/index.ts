/**
 * PRISM Verification Engine — Public API
 *
 * This module is the single entry point for the verification system.
 * It orchestrates criteria extraction, gate verification, and fix loops.
 *
 * Usage in the pipeline:
 *   import { VerificationEngine } from "./verification";
 *   const engine = new VerificationEngine(emitEvent);
 *   await engine.extractCriteria(taskId, brief);
 *   const report = await engine.runGate(taskId, "post_strategy", agentOutputs);
 */

export { extractAcceptanceCriteria } from "./criteriaExtractor";
export { runGateVerification, GATE_CONFIG } from "./gateVerifier";
export { executeFixLoop, buildFixRequests, decideAfterFix } from "./fixLoop";

import { extractAcceptanceCriteria } from "./criteriaExtractor";
import { runGateVerification, GATE_CONFIG } from "./gateVerifier";
import { executeFixLoop, buildFixRequests, decideAfterFix } from "./fixLoop";
import {
  saveAcceptanceCriteria,
  getAcceptanceCriteria,
  saveVerificationReport,
} from "../db";
import type {
  AcceptanceCriteriaSet,
  VerificationReport,
  GatePhase,
  VerificationEvent,
} from "../../shared/verification";

/**
 * VerificationEngine — Stateful orchestrator for the verification flow.
 *
 * Holds the acceptance criteria for a task and provides high-level methods
 * for each step of the verification process.
 */
export class VerificationEngine {
  private criteriaSet: AcceptanceCriteriaSet | null = null;
  private emitEvent: (event: VerificationEvent) => void;

  constructor(emitEvent: (event: VerificationEvent) => void) {
    this.emitEvent = emitEvent;
  }

  /**
   * Step 1: Extract acceptance criteria from a requirements brief.
   * Called once after the requirements meeting concludes.
   */
  async extractCriteria(
    taskId: number,
    requirementsBrief: string,
  ): Promise<AcceptanceCriteriaSet> {
    this.criteriaSet = await extractAcceptanceCriteria(
      taskId,
      requirementsBrief,
    );

    // Persist to database
    await saveAcceptanceCriteria({
      taskId,
      criteria: this.criteriaSet.criteria,
      briefHash: this.criteriaSet.briefHash,
    });

    this.emitEvent({
      type: "verify:criteria_extracted",
      taskId,
      criteriaCount: this.criteriaSet.criteria.length,
      mustCount: this.criteriaSet.criteria.filter(
        (c) => c.priority === "must",
      ).length,
      timestamp: Date.now(),
    });

    return this.criteriaSet;
  }

  /**
   * Load previously extracted criteria from database (for resumed tasks).
   */
  async loadCriteria(taskId: number): Promise<AcceptanceCriteriaSet | null> {
    const row = await getAcceptanceCriteria(taskId);
    if (!row) return null;

    this.criteriaSet = {
      taskId,
      criteria: row.criteria as AcceptanceCriteriaSet["criteria"],
      generatedAt: row.createdAt.getTime(),
      briefHash: row.briefHash,
    };

    return this.criteriaSet;
  }

  /**
   * Step 2: Run a quality gate verification.
   * Returns the verification report and persists it to the database.
   */
  async runGate(
    taskId: number,
    gate: GatePhase,
    agentOutputs: Record<string, string>,
  ): Promise<VerificationReport> {
    if (!this.criteriaSet) {
      throw new Error(
        "No acceptance criteria loaded. Call extractCriteria() or loadCriteria() first.",
      );
    }

    const report = await runGateVerification(
      taskId,
      gate,
      this.criteriaSet,
      agentOutputs,
      this.emitEvent,
    );

    // Persist report to database
    await saveVerificationReport({
      taskId,
      gate,
      results: report.results,
      overallScore: report.overallScore,
      gatePass: report.gatePass ? 1 : 0,
      gateThreshold: report.gateThreshold,
      fixRound: 0,
    });

    return report;
  }

  /**
   * Step 3: Run a fix loop for failed criteria, then re-verify.
   * Returns the updated agent outputs and the new verification report.
   */
  async runFixAndReVerify(
    taskId: number,
    gate: GatePhase,
    originalReport: VerificationReport,
    agentOutputs: Record<string, string>,
    callAgent: (
      role: string,
      prompt: string,
      context: string,
    ) => Promise<string>,
  ): Promise<{
    updatedOutputs: Record<string, string>;
    report: VerificationReport;
    decision: "pass" | "degraded_pass" | "user_intervention";
  }> {
    if (!this.criteriaSet) {
      throw new Error("No acceptance criteria loaded.");
    }

    const config = GATE_CONFIG[gate];

    // Build fix requests from failed criteria
    const fixRequests = buildFixRequests(
      originalReport.results,
      this.criteriaSet.criteria,
      agentOutputs,
    );

    if (fixRequests.length === 0) {
      return {
        updatedOutputs: agentOutputs,
        report: originalReport,
        decision: originalReport.gatePass ? "pass" : "user_intervention",
      };
    }

    // Execute fix loop
    const updatedOutputs = await executeFixLoop(
      taskId,
      gate,
      fixRequests,
      agentOutputs,
      config.maxFixRounds,
      callAgent,
      this.emitEvent,
    );

    // Re-verify with updated outputs
    const reReport = await runGateVerification(
      taskId,
      gate,
      this.criteriaSet,
      updatedOutputs,
      this.emitEvent,
    );

    // Persist the re-verification report
    await saveVerificationReport({
      taskId,
      gate,
      results: reReport.results,
      overallScore: reReport.overallScore,
      gatePass: reReport.gatePass ? 1 : 0,
      gateThreshold: reReport.gateThreshold,
      fixRound: config.maxFixRounds,
    });

    // Decide outcome
    const decision = decideAfterFix(
      originalReport.overallScore,
      reReport.overallScore,
      reReport.gatePass,
      reReport.results,
      this.criteriaSet.criteria,
    );

    return {
      updatedOutputs,
      report: reReport,
      decision,
    };
  }

  /** Get the currently loaded criteria set */
  getCriteria(): AcceptanceCriteriaSet | null {
    return this.criteriaSet;
  }
}
