/**
 * PRISM Verification — Gate Verifier
 *
 * Runs quality gate verification by checking agent outputs
 * against acceptance criteria using LLM-based semantic evaluation.
 */

import { invokeLLM } from "../_core/llm";
import type {
  AcceptanceCriteriaSet,
  AcceptanceCriterion,
  CriterionResult,
  VerificationReport,
  GatePhase,
  VerificationEvent,
} from "../../shared/verification";

/** Gate configuration: which agents and thresholds apply to each gate */
export const GATE_CONFIG: Record<
  GatePhase,
  {
    relevantAgents: string[];
    threshold: number;
    maxFixRounds: number;
  }
> = {
  post_strategy: {
    relevantAgents: ["conductor", "researcher", "pm", "ux"],
    threshold: 80,
    maxFixRounds: 2,
  },
  post_build: {
    relevantAgents: ["backend", "frontend", "devops"],
    threshold: 75,
    maxFixRounds: 2,
  },
  final: {
    relevantAgents: [
      "conductor",
      "researcher",
      "pm",
      "ux",
      "backend",
      "frontend",
      "devops",
      "critic",
    ],
    threshold: 85,
    maxFixRounds: 1,
  },
};

const VERIFY_PROMPT = `You are the PRISM framework's quality verifier.

Given an acceptance criterion and related Agent outputs, determine whether the criterion is satisfied.

Judgment rules:
- **pass**: The output clearly covers the criterion's requirements
- **partial**: Partially covered, but with omissions or insufficient specificity
- **fail**: Not covered, or contradicts the criterion's requirements
- **not_applicable**: The criterion is not applicable at this stage

You **must** return a valid JSON object:
{
  "status": "pass" | "fail" | "partial" | "not_applicable",
  "reasoning": "Brief explanation of the judgment (1-2 sentences)",
  "fixAgent": "If fail/partial, which Agent should fix it (role name)",
  "fixSuggestion": "If fail/partial, specific fix suggestion (1 sentence)"
}`;

/**
 * Run gate verification against a set of acceptance criteria.
 *
 * @param taskId - The task being verified
 * @param gate - Which gate phase this is
 * @param criteriaSet - The full set of acceptance criteria
 * @param agentOutputs - Map of agent role → output text
 * @param emitEvent - Callback to emit verification events to the event bus
 * @returns A VerificationReport with per-criterion results and overall score
 */
export async function runGateVerification(
  taskId: number,
  gate: GatePhase,
  criteriaSet: AcceptanceCriteriaSet,
  agentOutputs: Record<string, string>,
  emitEvent: (event: VerificationEvent) => void,
): Promise<VerificationReport> {
  const config = GATE_CONFIG[gate];

  // Filter criteria relevant to this gate's agents
  const relevantCriteria = criteriaSet.criteria.filter((c) =>
    c.relatedAgents.some((a) => config.relevantAgents.includes(a)),
  );

  emitEvent({
    type: "verify:gate_start",
    taskId,
    gate,
    criteriaCount: relevantCriteria.length,
    timestamp: Date.now(),
  });

  const results: CriterionResult[] = [];

  for (const criterion of relevantCriteria) {
    // Collect outputs from agents related to this criterion
    const relevantOutputs = criterion.relatedAgents
      .filter((a) => agentOutputs[a])
      .map((a) => `### ${a}'s output\n${agentOutputs[a]}`)
      .join("\n\n---\n\n");

    if (!relevantOutputs.trim()) {
      results.push({
        criterionId: criterion.id,
        status: "not_applicable",
        reasoning: "Related agents have not produced output yet",
      });

      emitEvent({
        type: "verify:criterion_result",
        taskId,
        gate,
        criterionId: criterion.id,
        status: "not_applicable",
        reasoning: "Related agents have not produced output yet",
        timestamp: Date.now(),
      });
      continue;
    }

    try {
      const verifyResult = await invokeLLM({
        messages: [
          { role: "system", content: VERIFY_PROMPT },
          {
            role: "user",
            content: `## Acceptance Criterion\nID: ${criterion.id}\nDescription: ${criterion.description}\nPriority: ${criterion.priority}\nVerify Method: ${criterion.verifyMethod}\n\n## Related Agent Outputs\n${relevantOutputs}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "criterion_result",
            strict: true,
            schema: {
              type: "object",
              properties: {
                status: {
                  type: "string",
                  enum: ["pass", "fail", "partial", "not_applicable"],
                },
                reasoning: { type: "string" },
                fixAgent: { type: "string" },
                fixSuggestion: { type: "string" },
              },
              required: ["status", "reasoning", "fixAgent", "fixSuggestion"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = verifyResult.choices?.[0]?.message?.content;
      const parsed = JSON.parse(typeof content === "string" ? content : "{}");

      const result: CriterionResult = {
        criterionId: criterion.id,
        status: parsed.status ?? "fail",
        reasoning: parsed.reasoning ?? "Verification failed",
        fixAgent: parsed.fixAgent || undefined,
        fixSuggestion: parsed.fixSuggestion || undefined,
      };

      results.push(result);

      emitEvent({
        type: "verify:criterion_result",
        taskId,
        gate,
        criterionId: criterion.id,
        status: result.status,
        reasoning: result.reasoning,
        timestamp: Date.now(),
      });
    } catch (err) {
      // If LLM call fails, mark as fail with error info
      results.push({
        criterionId: criterion.id,
        status: "fail",
        reasoning: `Verification error: ${err instanceof Error ? err.message : "Unknown error"}`,
      });
    }
  }

  // Calculate overall score
  const overallScore = calculateScore(results, relevantCriteria);
  const gatePass = overallScore >= config.threshold;

  const report: VerificationReport = {
    taskId,
    phase: gate,
    results,
    overallScore,
    gatePass,
    gateThreshold: config.threshold,
    verifiedAt: Date.now(),
  };

  emitEvent({
    type: "verify:gate_result",
    taskId,
    gate,
    overallScore,
    gatePass,
    failedCriteria: results
      .filter((r) => r.status === "fail")
      .map((r) => r.criterionId),
    timestamp: Date.now(),
  });

  return report;
}

/**
 * Weighted scoring algorithm.
 * - must: weight 3
 * - should: weight 2
 * - nice_to_have: weight 1
 * - pass: 1.0, partial: 0.5, fail: 0, not_applicable: excluded
 */
function calculateScore(
  results: CriterionResult[],
  criteria: AcceptanceCriterion[],
): number {
  const weights: Record<string, number> = {
    must: 3,
    should: 2,
    nice_to_have: 1,
  };
  const statusScores: Record<string, number> = {
    pass: 1,
    partial: 0.5,
    fail: 0,
  };

  let totalWeight = 0;
  let weightedScore = 0;

  for (const result of results) {
    // Skip not_applicable criteria from scoring
    if (result.status === "not_applicable") continue;

    const criterion = criteria.find((c) => c.id === result.criterionId);
    if (!criterion) continue;

    const weight = weights[criterion.priority] ?? 1;
    totalWeight += weight;
    weightedScore += weight * (statusScores[result.status] ?? 0);
  }

  return totalWeight > 0
    ? Math.round((weightedScore / totalWeight) * 100)
    : 100;
}
