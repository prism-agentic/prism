/**
 * PRISM Agent Pipeline Simulator
 * Simulates the multi-agent collaboration pipeline for demo purposes.
 * Each phase activates specific agents with realistic delays and outputs.
 */
import { createAgentLog, updateTask } from "./db";

// Agent definitions matching the landing page
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

// Pipeline phases with assigned agents
const PIPELINE_PHASES = [
  {
    phase: 0,
    name: "Discover",
    agents: ["conductor", "researcher"],
    actions: [
      { agent: "conductor", action: "Analyzing task requirements", content: "Breaking down the task into subtasks and assigning to specialized agents..." },
      { agent: "researcher", action: "Gathering context", content: "Researching relevant technologies, market data, and best practices..." },
    ],
  },
  {
    phase: 1,
    name: "Strategy",
    agents: ["pm", "ux"],
    actions: [
      { agent: "pm", action: "Defining product requirements", content: "Creating user stories, acceptance criteria, and priority matrix..." },
      { agent: "ux", action: "Designing user experience", content: "Wireframing key flows, defining interaction patterns and design system..." },
    ],
  },
  {
    phase: 2,
    name: "Scaffold",
    agents: ["backend", "frontend"],
    actions: [
      { agent: "backend", action: "Designing system architecture", content: "Defining API contracts, database schema, and service boundaries..." },
      { agent: "frontend", action: "Setting up project structure", content: "Initializing frontend framework, component library, and routing..." },
    ],
  },
  {
    phase: 3,
    name: "Build",
    agents: ["backend", "frontend", "devops"],
    actions: [
      { agent: "backend", action: "Implementing core services", content: "Building API endpoints, business logic, and data access layer..." },
      { agent: "frontend", action: "Building UI components", content: "Implementing responsive layouts, interactive components, and state management..." },
      { agent: "devops", action: "Configuring infrastructure", content: "Setting up CI/CD pipeline, containerization, and deployment scripts..." },
    ],
  },
  {
    phase: 4,
    name: "Harden",
    agents: ["critic", "backend"],
    actions: [
      { agent: "critic", action: "Reviewing code quality", content: "Running static analysis, checking test coverage, and reviewing architecture decisions..." },
      { agent: "backend", action: "Optimizing performance", content: "Implementing caching strategies, query optimization, and load testing..." },
    ],
  },
  {
    phase: 5,
    name: "Launch",
    agents: ["devops", "growth"],
    actions: [
      { agent: "devops", action: "Deploying to production", content: "Running deployment pipeline, health checks, and monitoring setup..." },
      { agent: "growth", action: "Preparing launch strategy", content: "Setting up analytics, A/B testing framework, and growth metrics dashboard..." },
    ],
  },
];

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Simulate the full agent pipeline for a task.
 * Creates realistic agent logs with delays to mimic real processing.
 */
export async function simulateAgentPipeline(taskId: number, prompt: string) {
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

      for (const action of phase.actions) {
        const agent = AGENTS.find(a => a.role === action.agent)!;

        // Log "thinking" state
        await createAgentLog({
          taskId,
          agentName: agent.name,
          agentRole: agent.role,
          phase: phase.phase,
          action: action.action,
          content: null,
          status: "thinking",
        });

        // Simulate processing time (1.5-3s)
        await sleep(1500 + Math.random() * 1500);

        // Log "working" state with content
        await createAgentLog({
          taskId,
          agentName: agent.name,
          agentRole: agent.role,
          phase: phase.phase,
          action: action.action,
          content: action.content,
          status: "working",
          durationMs: Math.floor(1500 + Math.random() * 3000),
        });

        // Simulate more work
        await sleep(800 + Math.random() * 1200);

        // Log "done" state
        await createAgentLog({
          taskId,
          agentName: agent.name,
          agentRole: agent.role,
          phase: phase.phase,
          action: action.action,
          content: `Completed: ${action.content}`,
          status: "done",
          durationMs: Math.floor(2000 + Math.random() * 4000),
        });
      }

      // Small delay between phases
      await sleep(500);
    }

    // Mark task as completed
    await updateTask(taskId, {
      status: "completed",
      currentPhase: 5,
      completedAt: new Date(),
      result: {
        summary: `Task "${prompt}" completed successfully through 6 pipeline phases with 9 specialized agents.`,
        phases: PIPELINE_PHASES.map(p => p.name),
        agentsUsed: AGENTS.length,
      },
    });
  } catch (error) {
    console.error("[AgentSimulator] Error:", error);
    await updateTask(taskId, {
      status: "failed",
      completedAt: new Date(),
    }).catch(() => {});
  }
}
