/**
 * PRISM Verification — Acceptance Criteria Extractor
 *
 * Extracts structured acceptance criteria from a requirements brief
 * using LLM with JSON schema response format.
 */

import { invokeLLM } from "../_core/llm";
import type { AcceptanceCriteriaSet } from "../../shared/verification";

const EXTRACTION_PROMPT = `You are the PRISM framework's acceptance criteria extractor.

Given a requirements brief, extract structured acceptance criteria. Each criterion must be:
- **Decidable**: Can be clearly judged as "met" or "not met"
- **Traceable**: Can be linked to a specific part of the requirements brief
- **Prioritized**: Distinguish between "must have" and "nice to have"

Extract from these dimensions:
1. **core_feature**: Core functional requirements → 1-2 criteria per MVP feature
2. **tech_preference**: Technical preferences → User-specified tech stack, architecture constraints
3. **success_metric**: Success criteria → Measurable KPIs
4. **key_decision**: Key decisions → Important directions confirmed during meetings

Output rules:
- Total count between 8-15 criteria
- "must" priority criteria should not exceed 60% of total
- Each criterion description in one sentence, no more than 80 characters
- relatedAgents should list the Agent roles whose output must satisfy this criterion

You **must** return a valid JSON object in the specified format.`;

export async function extractAcceptanceCriteria(
  taskId: number,
  requirementsBrief: string,
): Promise<AcceptanceCriteriaSet> {
  const result = await invokeLLM({
    messages: [
      { role: "system", content: EXTRACTION_PROMPT },
      { role: "user", content: `## Requirements Brief\n\n${requirementsBrief}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "acceptance_criteria",
        strict: true,
        schema: {
          type: "object",
          properties: {
            criteria: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  source: {
                    type: "string",
                    enum: [
                      "core_feature",
                      "tech_preference",
                      "success_metric",
                      "key_decision",
                    ],
                  },
                  description: { type: "string" },
                  verifyMethod: {
                    type: "string",
                    enum: [
                      "content_check",
                      "structure_check",
                      "consistency_check",
                    ],
                  },
                  relatedAgents: { type: "array", items: { type: "string" } },
                  priority: {
                    type: "string",
                    enum: ["must", "should", "nice_to_have"],
                  },
                },
                required: [
                  "id",
                  "source",
                  "description",
                  "verifyMethod",
                  "relatedAgents",
                  "priority",
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["criteria"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = result.choices?.[0]?.message?.content;
  const parsed = JSON.parse(typeof content === "string" ? content : "{}");

  return {
    taskId,
    criteria: parsed.criteria ?? [],
    generatedAt: Date.now(),
    briefHash: simpleHash(requirementsBrief),
  };
}

/** Simple string hash for change detection */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(36);
}
