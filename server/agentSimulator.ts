/**
 * PRISM Agent Pipeline — LLM-Driven Multi-Agent Collaboration
 * Each agent has a specialized system prompt and receives context
 * from previous agents to form a real collaboration chain.
 */
import { invokeLLM } from "./_core/llm";
import { createAgentLog, updateTask } from "./db";

// ─── Agent Definitions ───────────────────────────────────────────────
const AGENTS = [
  { name: "Conductor", role: "conductor", department: "specialized" },
  { name: "Researcher", role: "researcher", department: "specialized" },
  { name: "Product Manager", role: "pm", department: "business" },
  { name: "UX Designer", role: "ux", department: "design" },
  { name: "Backend Architect", role: "backend", department: "engineering" },
  { name: "Frontend Developer", role: "frontend", department: "engineering" },
  { name: "DevOps Engineer", role: "devops", department: "engineering" },
  { name: "Quality Critic", role: "critic", department: "specialized" },
  { name: "Growth Hacker", role: "growth", department: "business" },
] as const;

// ─── Agent System Prompts ────────────────────────────────────────────
const AGENT_PROMPTS: Record<string, string> = {
  conductor: `You are the **Conductor** — the orchestration leader of a multi-agent software development team called PRISM.

Your job is to:
1. Analyze the user's task/requirement thoroughly
2. Break it down into clear, actionable subtasks
3. Assign each subtask to the appropriate specialist agent
4. Define the execution order and dependencies

Output a structured task breakdown in Markdown with:
- **Project Overview**: One-paragraph summary of what needs to be built
- **Subtask List**: Numbered list with agent assignment, priority, and description
- **Execution Plan**: Phase-by-phase ordering

Keep it concise but comprehensive. Use professional language.`,

  researcher: `You are the **Researcher** — the technical intelligence agent in the PRISM team.

Based on the Conductor's task breakdown, your job is to:
1. Identify the best technology stack for this project
2. Research relevant frameworks, libraries, and tools
3. Analyze potential technical risks and mitigation strategies
4. Provide competitive landscape insights if applicable

Output a structured research report in Markdown with:
- **Recommended Tech Stack**: With justification for each choice
- **Key Libraries & Tools**: Specific packages with versions
- **Risk Assessment**: Top 3 technical risks with mitigation
- **Market Context**: Brief competitive/market insight

Be specific with technology recommendations. Cite real frameworks and tools.`,

  pm: `You are the **Product Manager** — the requirements and strategy agent in the PRISM team.

Based on previous agents' analysis, your job is to:
1. Define clear user stories with acceptance criteria
2. Create a feature priority matrix (MoSCoW)
3. Define the MVP scope
4. Outline success metrics and KPIs

Output in Markdown with:
- **User Stories**: 3-5 key user stories in "As a... I want... So that..." format with acceptance criteria
- **MVP Scope**: Must-have vs Nice-to-have features
- **Success Metrics**: Measurable KPIs
- **Timeline Estimate**: Rough phase estimates

Focus on actionable, measurable requirements.`,

  ux: `You are the **UX Designer** — the user experience and interface design agent in the PRISM team.

Based on the PM's requirements, your job is to:
1. Define the information architecture
2. Describe key user flows
3. Specify the design system (colors, typography, spacing)
4. Detail the layout of core screens

Output in Markdown with:
- **Information Architecture**: Site map / navigation structure
- **Key User Flows**: Step-by-step flow descriptions for 2-3 core tasks
- **Design System**: Color palette, typography, spacing rules
- **Core Screens**: Detailed layout descriptions for main pages

Be specific about visual design decisions and interaction patterns.`,

  backend: `You are the **Backend Architect** — the server-side engineering agent in the PRISM team.

Based on the research and requirements, your job is to:
1. Design the database schema
2. Define API endpoints and contracts
3. Plan the service architecture
4. Specify authentication and security measures

Output in Markdown with:
- **Database Schema**: Tables with columns, types, and relationships (use code blocks)
- **API Design**: RESTful or GraphQL endpoints with request/response examples
- **Architecture**: Service boundaries, data flow, caching strategy
- **Security**: Auth flow, input validation, rate limiting

Use code blocks for schemas and API examples. Be implementation-ready.`,

  frontend: `You are the **Frontend Developer** — the client-side engineering agent in the PRISM team.

Based on the UX design and backend API, your job is to:
1. Define the component architecture
2. Plan state management strategy
3. Specify key component implementations
4. Detail responsive design approach

Output in Markdown with:
- **Component Tree**: Hierarchical component structure
- **State Management**: Global vs local state, data fetching strategy
- **Key Components**: 2-3 core component specifications with props
- **Responsive Strategy**: Breakpoints and mobile-first approach

Include code snippets for key components. Focus on React/TypeScript patterns.`,

  devops: `You are the **DevOps Engineer** — the infrastructure and deployment agent in the PRISM team.

Based on the architecture decisions, your job is to:
1. Design the CI/CD pipeline
2. Plan the deployment architecture
3. Set up monitoring and alerting
4. Define environment configuration

Output in Markdown with:
- **CI/CD Pipeline**: Build, test, deploy stages
- **Infrastructure**: Hosting, CDN, database hosting recommendations
- **Monitoring**: Key metrics, alerting thresholds, logging strategy
- **Environment Config**: Environment variables, secrets management

Be specific about tools and configurations. Include pipeline YAML snippets where helpful.`,

  critic: `You are the **Quality Critic** — the code review and quality assurance agent in the PRISM team.

Review ALL previous agents' outputs and your job is to:
1. Identify potential issues, gaps, or inconsistencies
2. Suggest improvements and optimizations
3. Check for security vulnerabilities
4. Verify completeness against original requirements

Output in Markdown with:
- **Issues Found**: Numbered list of problems with severity (Critical/High/Medium/Low)
- **Improvement Suggestions**: Specific, actionable recommendations
- **Security Review**: Potential vulnerabilities and fixes
- **Completeness Check**: Requirements coverage assessment

Be constructive but thorough. Every issue should have a suggested fix.`,

  growth: `You are the **Growth Hacker** — the launch and growth strategy agent in the PRISM team.

Based on the complete project plan, your job is to:
1. Define the go-to-market strategy
2. Plan user acquisition channels
3. Set up analytics and tracking
4. Design onboarding and retention flows

Output in Markdown with:
- **Launch Plan**: Pre-launch, launch day, post-launch activities
- **Acquisition Channels**: Top 3 channels with tactics and estimated costs
- **Analytics Setup**: Key events to track, funnel definitions
- **Retention Strategy**: Onboarding flow, engagement hooks, re-engagement tactics

Focus on actionable, low-cost growth tactics suitable for startups.`,
};

// ─── Pipeline Phases ─────────────────────────────────────────────────
const PIPELINE_PHASES = [
  { phase: 0, name: "Discover",  agents: ["conductor", "researcher"] },
  { phase: 1, name: "Strategy",  agents: ["pm", "ux"] },
  { phase: 2, name: "Scaffold",  agents: ["backend", "frontend"] },
  { phase: 3, name: "Build",     agents: ["backend", "frontend", "devops"] },
  { phase: 4, name: "Harden",    agents: ["critic"] },
  { phase: 5, name: "Launch",    agents: ["growth"] },
];

// ─── LLM Call Helper ─────────────────────────────────────────────────
async function callAgent(
  agentRole: string,
  userPrompt: string,
  previousContext: string,
): Promise<string> {
  const systemPrompt = AGENT_PROMPTS[agentRole];
  if (!systemPrompt) {
    throw new Error(`No prompt defined for agent role: ${agentRole}`);
  }

  const messages: Array<{ role: "system" | "user"; content: string }> = [
    { role: "system", content: systemPrompt },
  ];

  // Build the user message with context from previous agents
  let userMessage = `## User's Task\n${userPrompt}`;
  if (previousContext.trim()) {
    userMessage += `\n\n## Context from Previous Agents\n${previousContext}`;
  }
  userMessage += `\n\nPlease provide your analysis and deliverables based on the above. Be concise but thorough. Respond in the same language as the user's task description. If a Requirements Brief is provided in the context, treat it as the authoritative source of truth for project requirements.`;

  messages.push({ role: "user", content: userMessage });

  const MAX_RETRIES = 3;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await invokeLLM({ messages, maxTokens: 4096 });
      const content = result.choices?.[0]?.message?.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map(c => c.text)
          .join("\n");
      }
      return "Agent completed analysis but produced no text output.";
    } catch (error) {
      console.error(`[AgentSimulator] LLM call failed for ${agentRole} (attempt ${attempt}/${MAX_RETRIES}):`, error);
      if (attempt < MAX_RETRIES) {
        // Exponential backoff: 2s, 4s
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`[AgentSimulator] Retrying ${agentRole} in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        return `[Error] Agent ${agentRole} encountered an issue after ${MAX_RETRIES} attempts. Falling back to summary mode.\n\nThe ${agentRole} agent was unable to complete its analysis due to a temporary service issue. The pipeline will continue with available context.`;
      }
    }
  }
  return "Agent completed but produced no output.";
}

// ─── Main Pipeline Executor ──────────────────────────────────────────
export async function simulateAgentPipeline(taskId: number, prompt: string, requirementsBrief?: string) {
  // Accumulates outputs from all agents for context passing
  const agentOutputs: Record<string, string> = {};

  // If we have a requirements brief from the meeting, inject it as pre-existing context
  if (requirementsBrief) {
    agentOutputs["requirements_brief"] = requirementsBrief;
  }

  try {
    // Mark task as running
    await updateTask(taskId, {
      status: "running",
      startedAt: new Date(),
      currentPhase: 0,
    });

    for (const phase of PIPELINE_PHASES) {
      // Update task phase
      await updateTask(taskId, { currentPhase: phase.phase });

      for (const agentRole of phase.agents) {
        const agent = AGENTS.find(a => a.role === agentRole)!;
        const actionLabel = getActionLabel(agentRole, phase.phase);

        // Log "thinking" state
        await createAgentLog({
          taskId,
          agentName: agent.name,
          agentRole: agent.role,
          phase: phase.phase,
          action: actionLabel,
          content: null,
          status: "thinking",
        });

        // Build context from previous agents' outputs
        const previousContext = buildContext(agentOutputs, agentRole);

        // Log "working" state
        await createAgentLog({
          taskId,
          agentName: agent.name,
          agentRole: agent.role,
          phase: phase.phase,
          action: actionLabel,
          content: "Analyzing and generating deliverables with AI...",
          status: "working",
        });

        // Call LLM for real agent output
        const startTime = Date.now();
        const output = await callAgent(agentRole, prompt, previousContext);
        const durationMs = Date.now() - startTime;

        // Store output for context chain
        const outputKey = phase.phase === 3 && agentRole !== "devops"
          ? `${agentRole}_build`  // Phase 3 reuses backend/frontend, use unique keys
          : agentRole;
        agentOutputs[outputKey] = output;

        // Log "done" state with LLM-generated content
        await createAgentLog({
          taskId,
          agentName: agent.name,
          agentRole: agent.role,
          phase: phase.phase,
          action: actionLabel,
          content: output,
          status: "done",
          durationMs,
        });
      }
    }

    // Build final result summary
    const resultSummary = buildResultSummary(prompt, agentOutputs);

    // Mark task as completed
    await updateTask(taskId, {
      status: "completed",
      currentPhase: 5,
      completedAt: new Date(),
      result: resultSummary,
    });
  } catch (error) {
    console.error("[AgentSimulator] Pipeline error:", error);
    await updateTask(taskId, {
      status: "failed",
      completedAt: new Date(),
      result: { error: String(error) },
    }).catch(() => {});
  }
}

// ─── Helper: Action Labels ──────────────────────────────────────────
function getActionLabel(role: string, phase: number): string {
  const labels: Record<string, Record<number, string>> = {
    conductor: { 0: "Analyzing & decomposing task" },
    researcher: { 0: "Researching technologies & market" },
    pm:       { 1: "Defining requirements & user stories" },
    ux:       { 1: "Designing user experience & flows" },
    backend:  { 2: "Designing system architecture", 3: "Implementing core services", 4: "Optimizing performance" },
    frontend: { 2: "Planning component architecture", 3: "Building UI implementation" },
    devops:   { 3: "Configuring infrastructure & CI/CD" },
    critic:   { 4: "Reviewing quality & security" },
    growth:   { 5: "Planning launch & growth strategy" },
  };
  return labels[role]?.[phase] ?? "Processing";
}

// ─── Helper: Build Context for Agent ─────────────────────────────────
function buildContext(outputs: Record<string, string>, currentRole: string): string {
  // Define what context each agent receives
  const contextMap: Record<string, string[]> = {
    conductor: ["requirements_brief"],                     // Sees requirements brief if available
    researcher: ["conductor", "requirements_brief"],       // Sees task breakdown + brief
    pm:       ["conductor", "researcher", "requirements_brief"], // Sees breakdown + research + brief
    ux:       ["pm", "requirements_brief"],                 // Sees requirements + brief
    backend:  ["researcher", "pm", "ux", "requirements_brief"], // Sees research + requirements + UX + brief
    frontend: ["ux", "backend", "requirements_brief"],     // Sees UX + backend API + brief
    devops:   ["backend", "backend_build"],                // Sees architecture
    critic:   ["conductor", "pm", "backend", "frontend", "backend_build", "frontend_build"], // Sees everything
    growth:   ["pm", "critic"],                           // Sees requirements + quality review
  };

  const relevantKeys = contextMap[currentRole] ?? [];
  const contextParts: string[] = [];

  for (const key of relevantKeys) {
    if (outputs[key]) {
      const agentName = AGENTS.find(a => a.role === key)?.name ?? key;
      contextParts.push(`### ${agentName}'s Output\n${outputs[key]}`);
    }
  }

  return contextParts.join("\n\n---\n\n");
}

// ─── Helper: Build Final Result ──────────────────────────────────────
function buildResultSummary(
  prompt: string,
  outputs: Record<string, string>,
): Record<string, unknown> {
  return {
    summary: `Task "${prompt}" completed successfully through 6 pipeline phases with ${AGENTS.length} specialized AI agents.`,
    phases: PIPELINE_PHASES.map(p => p.name),
    agentsUsed: AGENTS.length,
    deliverables: Object.entries(outputs).map(([role, content]) => ({
      agent: AGENTS.find(a => a.role === role)?.name ?? role,
      role,
      contentLength: content.length,
      preview: content.substring(0, 200) + (content.length > 200 ? "..." : ""),
    })),
  };
}
