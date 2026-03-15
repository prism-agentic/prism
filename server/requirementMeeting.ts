/**
 * PRISM Requirement Meeting Engine
 * 
 * Structured meeting with intelligent routing:
 *   Round 1 (fixed): Conductor → Researcher → PM (sequential analysis)
 *   Round 2+ (smart): Conductor routes user reply → dispatch to best-fit agent
 *   End: PM assembles Requirements Brief from all meeting context
 */
import { invokeLLM } from "./_core/llm";
import { createMeetingMessage, updateTask, getTaskMeetingMessages } from "./db";

// ─── Meeting Agent Prompts ──────────────────────────────────────────

const MEETING_PROMPTS = {
  /** Conductor: initial task analysis + complexity assessment */
  conductor_round1: `You are the **Conductor** in a requirement meeting for the PRISM multi-agent framework.

The user has submitted a new task. Your job in this meeting is to:
1. Analyze the task description and identify key dimensions (scope, complexity, domain)
2. Break down what information is still missing or ambiguous
3. Identify the core problem the user is trying to solve
4. Assess whether this needs deep clarification or is straightforward

Output in Markdown:
- **Task Understanding**: Your interpretation of what the user wants (2-3 sentences)
- **Key Dimensions**: List the main aspects (target users, core features, technical constraints, timeline)
- **Information Gaps**: What's unclear or missing that we need to clarify
- **Complexity Assessment**: Simple / Moderate / Complex — with brief justification

Keep it concise and actionable. Respond in the same language as the user's task.`,

  /** Researcher: competitive landscape + market intelligence */
  researcher_round1: `You are the **Researcher** in a requirement meeting for the PRISM multi-agent framework.

Based on the Conductor's analysis, your job is to:
1. Identify the top 2-3 existing products/solutions that address the user's need (Follow the Best)
2. Analyze their core features, strengths, and differentiators
3. Note what technology stacks they use (if relevant)
4. Highlight opportunities for differentiation

Output in Markdown:
- **Market Landscape**: Brief overview of the space
- **Top Competitors**: For each (2-3 products):
  - Name and brief description
  - Core solution / key features
  - Strengths and weaknesses
  - Technology approach (if known)
- **Differentiation Opportunities**: What gaps exist that the user could exploit
- **Recommendation**: Which product to study most closely and why

Be specific — name real products, real features, real numbers where possible. Respond in the same language as the user's task.`,

  /** PM: structured clarification questions informed by research */
  pm_round1: `You are the **Product Manager** in a requirement meeting for the PRISM multi-agent framework.

Based on the Conductor's analysis and Researcher's competitive intelligence, your job is to:
1. Synthesize the findings into clear, structured clarification questions
2. Each question should reference the competitive research where relevant
3. Questions should help narrow down the MVP scope

Generate exactly 3-5 clarification questions. For each question:
- Make it specific and actionable (not vague like "what do you want?")
- Reference competitor products as options where applicable (e.g., "Do you prefer Linear's minimal kanban approach or Jira's full project management suite?")
- Cover different dimensions: target users, core features, technical preferences, scope/timeline

Output in Markdown:
- **Questions for You**: Numbered list of 3-5 questions
  - Each question should be 1-2 sentences
  - Include context/options from the competitive research to help the user decide

End with a brief note: "Feel free to answer any or all questions. You can also skip and let us proceed with our best judgment."

Respond in the same language as the user's task.`,

  /** Conductor: classify user reply and decide which agent should respond */
  conductor_router: `You are the **Conductor** acting as an intelligent router in a requirement meeting.

The user has replied to the meeting discussion. Analyze their reply and determine which agent(s) should respond:

- **conductor**: If the user asks about project scope, feasibility, timeline, team size, or overall approach
- **researcher**: If the user asks about technology choices, market comparisons, competitor features, or wants more research
- **pm**: If the user discusses features, priorities, user stories, MVP scope, or business requirements

You MUST respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "respondents": ["agent_role_1", "agent_role_2"],
  "reasoning": "Brief explanation of why these agents should respond",
  "isResolved": false
}

Rules:
- "respondents" must contain 1-2 agent roles from: "conductor", "researcher", "pm"
- Set "isResolved" to true ONLY if the user explicitly says they're done or satisfied
- Usually 1 agent is enough; use 2 only if the reply clearly spans two domains
- If unclear, default to ["pm"] as they handle most product discussions`,

  /** Follow-up prompts for each agent in Round 2+ */
  conductor_followup: `You are the **Conductor** responding to the user in a requirement meeting.

Based on the meeting context and the user's latest reply, provide a helpful response about project scope, feasibility, or approach. Be concise (3-5 sentences). Reference previous discussion points. Respond in the same language as the user's task.`,

  researcher_followup: `You are the **Researcher** responding to the user in a requirement meeting.

Based on the meeting context and the user's latest reply, provide additional research insights, technology comparisons, or competitive intelligence. Be specific with product names and features. Be concise (3-5 sentences). Respond in the same language as the user's task.`,

  pm_followup: `You are the **Product Manager** responding to the user in a requirement meeting.

Based on the meeting context and the user's latest reply, help clarify requirements, refine feature priorities, or narrow down the MVP scope. If the user has answered questions, acknowledge and build on their answers. May ask 1-2 follow-up questions if needed. Be concise. Respond in the same language as the user's task.`,

  /** PM: generate the final Requirements Brief */
  pm_brief: `You are the **Product Manager** concluding a requirement meeting for the PRISM multi-agent framework.

Based on ALL the meeting discussion (Conductor's analysis, Researcher's competitive intelligence, your questions, and the user's answers), generate a comprehensive **Requirements Brief** that will guide all downstream agents.

Output a structured Requirements Brief in Markdown:

# Requirements Brief

## Project Overview
(2-3 sentence summary of what we're building and why)

## Target Users
(Who is this for? Primary and secondary personas)

## Competitive Reference
(Which products we're learning from and what to adopt/avoid — based on Researcher's findings)

## Core Features (MVP)
(Numbered list of must-have features with brief descriptions)

## Nice-to-Have Features
(Features for post-MVP)

## Technical Preferences
(Any stated preferences for tech stack, architecture, or constraints)

## Success Criteria
(How do we know this is done well? 2-3 measurable criteria)

## Key Decisions Made
(Important decisions from the meeting discussion)

Be specific and actionable. This document will be the single source of truth for all agents. Respond in the same language as the user's task.`,
};

// ─── LLM Helper ─────────────────────────────────────────────────────

async function callMeetingAgent(
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        maxTokens: 3000,
      });
      const content = result.choices?.[0]?.message?.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map(c => c.text)
          .join("\n");
      }
      return "Agent completed but produced no text output.";
    } catch (error) {
      console.error(`[Meeting] LLM call failed (attempt ${attempt}/${MAX_RETRIES}):`, error);
      if (attempt < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      } else {
        return `[Meeting agent encountered a temporary issue. The meeting will continue with available context.]`;
      }
    }
  }
  return "Agent completed but produced no output.";
}

// ─── Round 1: Fixed Analysis Chain ──────────────────────────────────

export async function runMeetingRound1(taskId: number, prompt: string) {
  try {
    // Mark task as clarifying
    await updateTask(taskId, { status: "clarifying", meetingRound: 1 });

    // Step 1: Conductor analyzes
    const conductorOutput = await callMeetingAgent(
      MEETING_PROMPTS.conductor_round1,
      `## User's Task\n${prompt}`,
    );
    await createMeetingMessage({
      taskId,
      sender: "conductor",
      round: 1,
      content: conductorOutput,
      messageType: "analysis",
    });

    // Step 2: Researcher does competitive research
    const researcherOutput = await callMeetingAgent(
      MEETING_PROMPTS.researcher_round1,
      `## User's Task\n${prompt}\n\n## Conductor's Analysis\n${conductorOutput}`,
    );
    await createMeetingMessage({
      taskId,
      sender: "researcher",
      round: 1,
      content: researcherOutput,
      messageType: "research",
    });

    // Step 3: PM generates structured questions
    const pmOutput = await callMeetingAgent(
      MEETING_PROMPTS.pm_round1,
      `## User's Task\n${prompt}\n\n## Conductor's Analysis\n${conductorOutput}\n\n## Researcher's Competitive Intelligence\n${researcherOutput}`,
    );
    await createMeetingMessage({
      taskId,
      sender: "pm",
      round: 1,
      content: pmOutput,
      messageType: "questions",
    });

    console.log(`[Meeting] Round 1 complete for task ${taskId}. Waiting for user reply.`);
  } catch (error) {
    console.error(`[Meeting] Round 1 error for task ${taskId}:`, error);
    // Don't fail the task — let user still proceed
    await createMeetingMessage({
      taskId,
      sender: "conductor",
      round: 1,
      content: "The meeting encountered a temporary issue. You can still proceed by clicking 'Start Execution' or try replying to continue the discussion.",
      messageType: "error",
    });
  }
}

// ─── Round 2+: Intelligent Routing ──────────────────────────────────

export async function handleUserReply(taskId: number, prompt: string, userReply: string) {
  // Save user message
  const messages = await getTaskMeetingMessages(taskId);
  const currentRound = Math.max(...messages.map(m => m.round), 0) + 1;

  await createMeetingMessage({
    taskId,
    sender: "user",
    round: currentRound,
    content: userReply,
    messageType: "reply",
  });

  // Build meeting context for the router
  const meetingContext = messages
    .map(m => `[${m.sender.toUpperCase()}] (Round ${m.round}): ${m.content}`)
    .join("\n\n---\n\n");

  // Step 1: Conductor routes the reply
  const routerInput = `## Original Task\n${prompt}\n\n## Meeting History\n${meetingContext}\n\n## User's Latest Reply\n${userReply}`;
  const routerOutput = await callMeetingAgent(MEETING_PROMPTS.conductor_router, routerInput);

  let respondents: string[] = ["pm"];
  let isResolved = false;

  try {
    // Parse JSON from the router output (handle potential markdown wrapping)
    const jsonStr = routerOutput.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    if (Array.isArray(parsed.respondents)) {
      respondents = parsed.respondents.filter((r: string) =>
        ["conductor", "researcher", "pm"].includes(r)
      );
      if (respondents.length === 0) respondents = ["pm"];
    }
    isResolved = !!parsed.isResolved;
  } catch {
    console.warn("[Meeting] Failed to parse router output, defaulting to PM:", routerOutput);
  }

  if (isResolved) {
    // User is satisfied — generate brief and proceed
    await generateRequirementsBrief(taskId, prompt);
    return { isResolved: true, respondents: [] };
  }

  // Step 2: Dispatch to selected agents
  const followupPrompts: Record<string, string> = {
    conductor: MEETING_PROMPTS.conductor_followup,
    researcher: MEETING_PROMPTS.researcher_followup,
    pm: MEETING_PROMPTS.pm_followup,
  };

  const fullContext = `## Original Task\n${prompt}\n\n## Meeting History\n${meetingContext}\n\n## User's Latest Reply\n${userReply}`;

  for (const agent of respondents) {
    const agentPrompt = followupPrompts[agent];
    if (!agentPrompt) continue;

    const output = await callMeetingAgent(agentPrompt, fullContext);
    await createMeetingMessage({
      taskId,
      sender: agent,
      round: currentRound,
      content: output,
      messageType: "followup",
    });
  }

  // Update meeting round
  await updateTask(taskId, { meetingRound: currentRound });

  return { isResolved: false, respondents };
}

// ─── Generate Requirements Brief ───────────────────────────────────

export async function generateRequirementsBrief(taskId: number, prompt: string) {
  const messages = await getTaskMeetingMessages(taskId);

  const meetingTranscript = messages
    .map(m => {
      const label = m.sender === "user" ? "USER" : m.sender.toUpperCase();
      return `[${label}] (Round ${m.round}): ${m.content}`;
    })
    .join("\n\n---\n\n");

  const briefInput = `## Original Task\n${prompt}\n\n## Full Meeting Transcript\n${meetingTranscript}`;
  const brief = await callMeetingAgent(MEETING_PROMPTS.pm_brief, briefInput);

  // Save the brief as a meeting message and in the task
  await createMeetingMessage({
    taskId,
    sender: "pm",
    round: Math.max(...messages.map(m => m.round), 0) + 1,
    content: brief,
    messageType: "brief",
  });

  await updateTask(taskId, {
    requirementsBrief: { brief, generatedAt: new Date().toISOString() },
  });

  console.log(`[Meeting] Requirements Brief generated for task ${taskId}`);
  return brief;
}
