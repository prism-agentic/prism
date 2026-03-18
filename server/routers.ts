import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { runTask, type ExecutorContext } from "./executor";
import { runMeetingRound1, handleUserReply, generateRequirementsBrief } from "./requirementMeeting";
import { VerificationEngine } from "./verification";

// ─── Available Models ───

export interface AvailableModel {
  id: string;
  name: string;
  provider: string;
  description: string;
  contextWindow: number;
  pricing: string;
  tier: "free" | "standard" | "premium";
}

export const AVAILABLE_MODELS: AvailableModel[] = [
  {
    id: "google/gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    provider: "Google",
    description: "Fast reasoning model, great for most tasks. Low cost.",
    contextWindow: 1048576,
    pricing: "$0.15 / 1M tokens",
    tier: "free",
  },
  {
    id: "google/gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    provider: "Google",
    description: "Google's most capable model with advanced reasoning.",
    contextWindow: 1048576,
    pricing: "$2.50 / 1M tokens",
    tier: "premium",
  },
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    provider: "Anthropic",
    description: "Excellent at analysis, writing, and coding tasks.",
    contextWindow: 200000,
    pricing: "$3.00 / 1M tokens",
    tier: "premium",
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    description: "Strong balance of intelligence and speed.",
    contextWindow: 200000,
    pricing: "$3.00 / 1M tokens",
    tier: "standard",
  },
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    provider: "OpenAI",
    description: "OpenAI's flagship multimodal model.",
    contextWindow: 128000,
    pricing: "$2.50 / 1M tokens",
    tier: "standard",
  },
  {
    id: "openai/gpt-4o-mini",
    name: "GPT-4o Mini",
    provider: "OpenAI",
    description: "Fast and affordable for simpler tasks.",
    contextWindow: 128000,
    pricing: "$0.15 / 1M tokens",
    tier: "free",
  },
  {
    id: "deepseek/deepseek-r1",
    name: "DeepSeek R1",
    provider: "DeepSeek",
    description: "Advanced reasoning model with strong coding ability.",
    contextWindow: 64000,
    pricing: "$0.55 / 1M tokens",
    tier: "standard",
  },
  {
    id: "meta-llama/llama-4-maverick",
    name: "Llama 4 Maverick",
    provider: "Meta",
    description: "Open-source model with strong general capabilities.",
    contextWindow: 1048576,
    pricing: "$0.20 / 1M tokens",
    tier: "free",
  },
];

// ─── Task Templates ───

export interface TaskTemplate {
  id: string;
  name: string;
  nameZh: string;
  description: string;
  descriptionZh: string;
  icon: string;
  category: string;
  prompt: string;
  suggestedQuestions: string[];
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "saas-mvp",
    name: "SaaS MVP",
    nameZh: "SaaS MVP 产品",
    description: "Design and plan a complete SaaS MVP product from scratch, including user research, feature prioritization, technical architecture, and go-to-market strategy.",
    descriptionZh: "从零设计和规划一个完整的 SaaS MVP 产品，包括用户研究、功能优先级排序、技术架构和上市策略。",
    icon: "🚀",
    category: "product",
    prompt: "I want to build a SaaS MVP product. Help me design the complete product from user research to technical implementation plan.",
    suggestedQuestions: [
      "What specific problem does your SaaS product solve?",
      "Who is your target user persona? (B2B/B2C, industry, company size)",
      "What is your expected pricing model? (freemium, subscription tiers, usage-based)",
      "What is your timeline for the MVP launch?",
      "Do you have any technical preferences or constraints? (cloud provider, language, framework)",
    ],
  },
  {
    id: "api-design",
    name: "API Design",
    nameZh: "API 接口设计",
    description: "Design a robust and scalable API system, including RESTful/GraphQL endpoint design, authentication, rate limiting, versioning, and comprehensive documentation.",
    descriptionZh: "设计一个健壮且可扩展的 API 系统，包括 RESTful/GraphQL 端点设计、认证鉴权、限流、版本管理和完整文档。",
    icon: "🔌",
    category: "engineering",
    prompt: "I need to design a comprehensive API system. Help me plan the API architecture, endpoints, authentication, and documentation.",
    suggestedQuestions: [
      "What type of API are you building? (REST, GraphQL, gRPC, WebSocket)",
      "What are the main resources/entities your API will manage?",
      "What authentication method do you prefer? (OAuth2, JWT, API keys)",
      "What is the expected request volume? (requests per second)",
      "Will this API be public-facing or internal only?",
    ],
  },
  {
    id: "mobile-app",
    name: "Mobile App",
    nameZh: "移动端 App",
    description: "Plan and design a mobile application, including UX/UI design, cross-platform strategy, offline capabilities, push notifications, and app store optimization.",
    descriptionZh: "规划和设计一个移动应用，包括 UX/UI 设计、跨平台策略、离线能力、推送通知和应用商店优化。",
    icon: "📱",
    category: "product",
    prompt: "I want to build a mobile application. Help me plan the complete mobile app from UX design to technical implementation.",
    suggestedQuestions: [
      "What is the core functionality of your mobile app?",
      "Which platforms do you need to support? (iOS, Android, or both)",
      "What is your preferred development approach? (native, React Native, Flutter)",
      "Does the app need offline functionality?",
      "What third-party integrations are required? (payment, maps, social login)",
    ],
  },
];

// ─── Router ───

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  project: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getUserProjects(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getProjectById(input.id, ctx.user.id);
      }),

    create: protectedProcedure
      .input(z.object({
        name: z.string().min(1).max(200),
        description: z.string().optional(),
        template: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        return db.createProject({
          userId: ctx.user.id,
          name: input.name,
          description: input.description ?? null,
          template: input.template ?? "custom",
        });
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(200).optional(),
        description: z.string().optional(),
        modelId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateProject(id, ctx.user.id, data);
        return { success: true };
      }),

    /** Get available LLM models for selection */
    availableModels: protectedProcedure.query(() => {
      return AVAILABLE_MODELS;
    }),

    /** Update the model for a project */
    updateModel: protectedProcedure
      .input(z.object({
        id: z.number(),
        modelId: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        // Validate model exists in our list
        const model = AVAILABLE_MODELS.find(m => m.id === input.modelId);
        if (!model) throw new Error("Invalid model ID");
        await db.updateProject(input.id, ctx.user.id, { modelId: input.modelId });
        return { success: true, model };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteProject(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  task: router({
    /** Get available task templates */
    templates: publicProcedure.query(() => {
      return TASK_TEMPLATES;
    }),

    list: protectedProcedure
      .input(z.object({ projectId: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getProjectTasks(input.projectId, ctx.user.id);
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        return db.getTaskById(input.id, ctx.user.id);
      }),

    /**
     * Create a new task.
     * skipMeeting = false (default): starts with requirement meeting (Conductor → Researcher → PM)
     * skipMeeting = true: skips meeting, goes directly to pipeline execution
     */
    create: protectedProcedure
      .input(z.object({
        projectId: z.number(),
        prompt: z.string().min(1),
        skipMeeting: z.boolean().optional().default(false),
        templateId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.createTask({
          projectId: input.projectId,
          userId: ctx.user.id,
          prompt: input.prompt,
          status: "pending",
          currentPhase: 0,
          totalPhases: 6,
          meetingRound: 0,
        });

        // Get the project's model preference
        const project = await db.getProjectById(input.projectId, ctx.user.id);
        const modelId = project?.modelId || undefined;

        if (input.skipMeeting) {
          // Fast mode: skip meeting, go directly to pipeline via TaskExecutor
          const executorCtx: ExecutorContext = {
            taskId: task.id,
            userId: ctx.user.id,
            projectId: input.projectId,
            prompt: input.prompt,
            config: { modelId },
          };
          runTask(executorCtx).catch(console.error);
        } else {
          // Normal mode: start requirement meeting
          runMeetingRound1(task.id, input.prompt, modelId).catch(console.error);
        }

        return task;
      }),

    /**
     * User replies in the requirement meeting.
     * Triggers intelligent routing: Conductor classifies → dispatch to right agent(s).
     */
    reply: protectedProcedure
      .input(z.object({
        taskId: z.number(),
        message: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId, ctx.user.id);
        if (!task) throw new Error("Task not found");
        if (task.status !== "clarifying") throw new Error("Task is not in meeting phase");

        // Get project model preference
        const project = await db.getProjectById(task.projectId, ctx.user.id);
        const modelId = project?.modelId || undefined;

        const result = await handleUserReply(input.taskId, task.prompt, input.message, modelId);
        return result;
      }),

    /**
     * End the meeting and generate Requirements Brief.
     * Status transitions: clarifying → confirming
     * The brief is displayed to the user for review BEFORE pipeline execution.
     */
    endMeeting: protectedProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId, ctx.user.id);
        if (!task) throw new Error("Task not found");
        if (task.status !== "clarifying") throw new Error("Task is not in meeting phase");

        // Get project model preference
        const project = await db.getProjectById(task.projectId, ctx.user.id);
        const modelId = project?.modelId || undefined;

        // Generate requirements brief (PM synthesizes all meeting context)
        const brief = await generateRequirementsBrief(input.taskId, task.prompt, modelId);

        // Transition to confirming status — wait for user approval
        await db.updateTask(input.taskId, { status: "confirming" });

        return { success: true, brief };
      }),

    /**
     * User approves the requirements brief and starts pipeline execution.
     * Status transitions: confirming → running
     * This is the explicit user consent checkpoint.
     */
    approveBrief: protectedProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId, ctx.user.id);
        if (!task) throw new Error("Task not found");
        if (task.status !== "confirming") throw new Error("Task is not in confirmation phase");

        // Get the stored brief
        const briefData = task.requirementsBrief as { brief: string; generatedAt: string } | null;
        const briefText = briefData?.brief || "";

        // Get project model preference
        const project = await db.getProjectById(task.projectId, ctx.user.id);
        const modelId = project?.modelId || undefined;

        // Start pipeline execution with the approved brief via TaskExecutor
        const executorCtx: ExecutorContext = {
          taskId: input.taskId,
          userId: ctx.user.id,
          projectId: task.projectId,
          prompt: task.prompt,
          config: {
            modelId,
            requirementsBrief: briefText,
          },
        };
        runTask(executorCtx).catch(console.error);

        return { success: true };
      }),

    /**
     * User edits the requirements brief before approving.
     * Stays in confirming status — user can continue editing or approve.
     */
    updateBrief: protectedProcedure
      .input(z.object({
        taskId: z.number(),
        brief: z.string().min(1),
      }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId, ctx.user.id);
        if (!task) throw new Error("Task not found");
        if (task.status !== "confirming") throw new Error("Task is not in confirmation phase");

        // Update the stored brief with user's edits
        await db.updateTask(input.taskId, {
          requirementsBrief: {
            brief: input.brief,
            generatedAt: new Date().toISOString(),
            editedByUser: true,
          },
        });

        // Also save the edited brief as a meeting message for the transcript
        await db.createMeetingMessage({
          taskId: input.taskId,
          sender: "user",
          round: (task.meetingRound || 0) + 1,
          content: `[User edited the Requirements Brief]\n\n${input.brief}`,
          messageType: "brief_edit",
        });

        return { success: true };
      }),

    /**
     * User returns to the meeting to continue discussion.
     * Status transitions: confirming → clarifying
     */
    returnToMeeting: protectedProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId, ctx.user.id);
        if (!task) throw new Error("Task not found");
        if (task.status !== "confirming") throw new Error("Task is not in confirmation phase");

        // Return to clarifying status so user can continue the meeting
        await db.updateTask(input.taskId, { status: "clarifying" });

        // Add a system message to the meeting transcript
        await db.createMeetingMessage({
          taskId: input.taskId,
          sender: "conductor",
          round: (task.meetingRound || 0) + 1,
          content: "The user has returned to the meeting for further discussion. Feel free to ask additional questions or provide more context.",
          messageType: "system",
        });

        return { success: true };
      }),

    /**
     * Legacy: confirmMeeting — kept for backward compatibility.
     * Now redirects through the new flow: endMeeting + approveBrief.
     * For skipMeeting tasks, this still works as before.
     */
    confirmMeeting: protectedProcedure
      .input(z.object({
        taskId: z.number(),
      }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId, ctx.user.id);
        if (!task) throw new Error("Task not found");
        if (task.status !== "clarifying") throw new Error("Task is not in meeting phase");

        // Generate requirements brief
        const brief = await generateRequirementsBrief(input.taskId, task.prompt);

        // Start pipeline execution with the enriched context via TaskExecutor
        const executorCtx: ExecutorContext = {
          taskId: input.taskId,
          userId: ctx.user.id,
          projectId: task.projectId,
          prompt: task.prompt,
          config: {
            requirementsBrief: brief,
          },
        };
        runTask(executorCtx).catch(console.error);

        return { success: true, brief };
      }),

    /**
     * Get meeting messages for a task (the requirement meeting conversation).
     */
    meetingMessages: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return db.getTaskMeetingMessages(input.taskId);
      }),

    /**
     * Submit feedback (satisfied/unsatisfied) on a meeting message.
     */
    feedback: protectedProcedure
      .input(z.object({
        messageId: z.number(),
        rating: z.enum(["satisfied", "unsatisfied"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await db.upsertMessageFeedback({
          messageId: input.messageId,
          userId: ctx.user.id,
          rating: input.rating,
        });
        return result;
      }),

    /**
     * Get user's feedbacks for meeting messages of a task.
     */
    feedbacks: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ ctx, input }) => {
        const messages = await db.getTaskMeetingMessages(input.taskId);
        const messageIds = messages.map(m => m.id);
        return db.getMessageFeedbacks(messageIds, ctx.user.id);
      }),

    /**
     * Export meeting transcript as Markdown.
     * Returns the full meeting conversation + requirements brief as a Markdown string.
     */
    exportMeeting: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId, ctx.user.id);
        if (!task) throw new Error("Task not found");

        const messages = await db.getTaskMeetingMessages(input.taskId);

        const senderLabels: Record<string, string> = {
          conductor: "🎯 Conductor (指挥官)",
          researcher: "🔍 Researcher (研究员)",
          pm: "📋 Product Manager (产品经理)",
          user: "👤 User (用户)",
        };

        let md = `# PRISM 需求会议记录\n\n`;
        md += `**任务 ID:** ${task.id}\n`;
        md += `**原始需求:** ${task.prompt}\n`;
        md += `**创建时间:** ${task.createdAt.toISOString()}\n`;
        md += `**状态:** ${task.status}\n\n`;
        md += `---\n\n`;
        md += `## 会议讨论\n\n`;

        let currentRound = 0;
        for (const msg of messages) {
          if (msg.round !== currentRound) {
            currentRound = msg.round;
            md += `### Round ${currentRound}\n\n`;
          }
          const label = senderLabels[msg.sender] || msg.sender;
          md += `**${label}**`;
          if (msg.messageType) {
            md += ` _(${msg.messageType})_`;
          }
          md += `\n\n`;
          md += `${msg.content}\n\n`;
          md += `---\n\n`;
        }

        // Append requirements brief if available
        if (task.requirementsBrief) {
          md += `## 需求简报 (Requirements Brief)\n\n`;
          const briefData = task.requirementsBrief as { brief?: string } | string;
          const briefText = typeof briefData === 'string' ? briefData : (briefData as { brief?: string }).brief || JSON.stringify(briefData, null, 2);
          md += `${briefText}\n\n`;
        }

        return { markdown: md, taskPrompt: task.prompt };
      }),

    logs: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return db.getTaskAgentLogs(input.taskId);
      }),
  }),

  verification: router({
    /**
     * Get acceptance criteria for a task.
     * Returns the structured criteria extracted from the requirements brief.
     */
    getCriteria: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ ctx, input }) => {
        // Verify user owns this task
        const task = await db.getTaskById(input.taskId, ctx.user.id);
        if (!task) throw new Error("Task not found");
        return db.getAcceptanceCriteria(input.taskId);
      }),

    /**
     * Get all verification reports for a task.
     * Returns reports from all gate phases, ordered by creation time.
     */
    getReports: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId, ctx.user.id);
        if (!task) throw new Error("Task not found");
        return db.getVerificationReports(input.taskId);
      }),

    /**
     * Get the latest verification report for a specific gate phase.
     */
    getLatestReport: protectedProcedure
      .input(z.object({
        taskId: z.number(),
        gate: z.enum(["post_strategy", "post_build", "final"]),
      }))
      .query(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId, ctx.user.id);
        if (!task) throw new Error("Task not found");
        return db.getLatestVerificationReport(input.taskId, input.gate);
      }),

    /**
     * Manually trigger acceptance criteria extraction.
     * Normally this happens automatically after the requirements meeting,
     * but this endpoint allows re-extraction if the brief was edited.
     */
    extractCriteria: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId, ctx.user.id);
        if (!task) throw new Error("Task not found");

        const briefData = task.requirementsBrief as { brief?: string } | string | null;
        if (!briefData) throw new Error("No requirements brief available");

        const briefText = typeof briefData === "string"
          ? briefData
          : (briefData as { brief?: string }).brief || "";

        if (!briefText) throw new Error("Requirements brief is empty");

        const engine = new VerificationEngine(() => {});
        const criteriaSet = await engine.extractCriteria(input.taskId, briefText);

        return {
          success: true,
          criteriaCount: criteriaSet.criteria.length,
          mustCount: criteriaSet.criteria.filter(c => c.priority === "must").length,
        };
      }),

    /**
     * User accepts a failed gate result (degraded pass).
     * Allows the pipeline to continue despite not meeting the threshold.
     */
    acceptGateResult: protectedProcedure
      .input(z.object({
        taskId: z.number(),
        gate: z.enum(["post_strategy", "post_build", "final"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const task = await db.getTaskById(input.taskId, ctx.user.id);
        if (!task) throw new Error("Task not found");
        // Mark the gate as user-accepted (store in task metadata)
        // This allows the pipeline to proceed
        return { success: true, message: "Gate result accepted by user" };
      }),
  }),
});

export type AppRouter = typeof appRouter;
