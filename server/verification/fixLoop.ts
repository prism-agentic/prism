/**
 * PRISM Verification — Fix Loop
 *
 * When a quality gate fails, this module orchestrates targeted fixes
 * by asking specific agents to revise their outputs based on verification feedback.
 */

import type {
  AcceptanceCriterion,
  CriterionResult,
  GatePhase,
  VerificationEvent,
} from "../../shared/verification";

/** A request to fix a specific criterion failure */
export interface FixRequest {
  /** The failed acceptance criterion */
  criterion: AcceptanceCriterion;
  /** The verification result that triggered the fix */
  result: CriterionResult;
  /** The agent role that should perform the fix */
  targetAgent: string;
  /** The agent's previous output */
  previousOutput: string;
  /** Suggested fix approach */
  suggestion: string;
}

const FIX_PROMPT_TEMPLATE = `You are the {agentName} in the PRISM framework.

Your previous output did not satisfy the following acceptance criterion and needs to be fixed:

## Acceptance Criterion
{criterionDescription}

## Verification Feedback
Status: {status}
Reason: {reasoning}
Fix Suggestion: {fixSuggestion}

## Your Previous Output
{previousOutput}

Please revise and improve your output based on the above feedback. Requirements:
1. Fix the identified issue specifically, do not rewrite unrelated parts
2. Ensure the fixed content clearly satisfies the acceptance criterion
3. Start your output with a one-sentence summary of what you changed`;

/**
 * Execute a fix loop: for each failed criterion, ask the responsible agent to fix its output.
 *
 * @param taskId - The task being fixed
 * @param gate - Which gate triggered the fix
 * @param fixRequests - List of fix requests (one per failed criterion)
 * @param agentOutputs - Current agent outputs (will be updated in place)
 * @param maxRounds - Maximum number of fix rounds
 * @param callAgent - Callback to invoke an agent with a prompt
 * @param emitEvent - Callback to emit events
 * @returns Updated agent outputs after fixes
 */
export async function executeFixLoop(
  taskId: number,
  gate: GatePhase,
  fixRequests: FixRequest[],
  agentOutputs: Record<string, string>,
  maxRounds: number,
  callAgent: (
    role: string,
    prompt: string,
    context: string,
  ) => Promise<string>,
  emitEvent: (event: VerificationEvent) => void,
): Promise<Record<string, string>> {
  const updatedOutputs = { ...agentOutputs };

  for (let round = 1; round <= maxRounds; round++) {
    for (const fix of fixRequests) {
      emitEvent({
        type: "verify:fix_start",
        taskId,
        gate,
        round,
        fixAgent: fix.targetAgent,
        criterionId: fix.criterion.id,
        timestamp: Date.now(),
      });

      // Build the fix prompt from template
      const fixPrompt = FIX_PROMPT_TEMPLATE.replace(
        "{agentName}",
        fix.targetAgent,
      )
        .replace("{criterionDescription}", fix.criterion.description)
        .replace("{status}", fix.result.status)
        .replace("{reasoning}", fix.result.reasoning)
        .replace("{fixSuggestion}", fix.suggestion)
        .replace("{previousOutput}", fix.previousOutput);

      try {
        const fixedOutput = await callAgent(fix.targetAgent, fixPrompt, "");
        updatedOutputs[fix.targetAgent] = fixedOutput;

        emitEvent({
          type: "verify:fix_result",
          taskId,
          gate,
          round,
          fixAgent: fix.targetAgent,
          success: true,
          timestamp: Date.now(),
        });
      } catch (err) {
        emitEvent({
          type: "verify:fix_result",
          taskId,
          gate,
          round,
          fixAgent: fix.targetAgent,
          success: false,
          timestamp: Date.now(),
        });
      }
    }
  }

  return updatedOutputs;
}

/**
 * Build fix requests from a failed verification report.
 * Only creates requests for criteria that failed or partially passed.
 */
export function buildFixRequests(
  results: CriterionResult[],
  criteria: AcceptanceCriterion[],
  agentOutputs: Record<string, string>,
): FixRequest[] {
  const requests: FixRequest[] = [];

  for (const result of results) {
    if (result.status !== "fail" && result.status !== "partial") continue;

    const criterion = criteria.find((c) => c.id === result.criterionId);
    if (!criterion) continue;

    // Determine which agent should fix this
    const targetAgent =
      result.fixAgent ?? criterion.relatedAgents[0] ?? "conductor";
    const previousOutput = agentOutputs[targetAgent] ?? "";

    requests.push({
      criterion,
      result,
      targetAgent,
      previousOutput,
      suggestion: result.fixSuggestion ?? "Please review and fix the output",
    });
  }

  return requests;
}

/**
 * Decision logic after a fix loop completes.
 * Determines whether to pass, degrade-pass, or request user intervention.
 */
export function decideAfterFix(
  originalScore: number,
  fixedScore: number,
  fixedGatePass: boolean,
  fixedResults: CriterionResult[],
  criteria: AcceptanceCriterion[],
): "pass" | "degraded_pass" | "user_intervention" {
  if (fixedGatePass) {
    return "pass";
  }

  // Check if all "must" criteria pass
  const allMustPass = criteria
    .filter((c) => c.priority === "must")
    .every((c) => {
      const result = fixedResults.find((r) => r.criterionId === c.id);
      return (
        result &&
        (result.status === "pass" || result.status === "not_applicable")
      );
    });

  // Score improved and all must criteria pass → degraded pass
  if (fixedScore > originalScore && allMustPass) {
    return "degraded_pass";
  }

  return "user_intervention";
}
