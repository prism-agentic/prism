import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { simulateAgentPipeline } from "./agentSimulator";
import { runMeetingRound1, handleUserReply, generateRequirementsBrief } from "./requirementMeeting";

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
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...data } = input;
        await db.updateProject(id, ctx.user.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteProject(input.id, ctx.user.id);
        return { success: true };
      }),
  }),

  task: router({
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

        if (input.skipMeeting) {
          // Fast mode: skip meeting, go directly to pipeline
          simulateAgentPipeline(task.id, input.prompt).catch(console.error);
        } else {
          // Normal mode: start requirement meeting
          runMeetingRound1(task.id, input.prompt).catch(console.error);
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
        // Verify task belongs to user and is in clarifying state
        const task = await db.getTaskById(input.taskId, ctx.user.id);
        if (!task) throw new Error("Task not found");
        if (task.status !== "clarifying") throw new Error("Task is not in meeting phase");

        const result = await handleUserReply(input.taskId, task.prompt, input.message);
        return result;
      }),

    /**
     * User confirms the meeting is done.
     * PM generates Requirements Brief, then pipeline execution begins.
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

        // Start pipeline execution with the enriched context
        simulateAgentPipeline(input.taskId, task.prompt, brief).catch(console.error);

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

    logs: protectedProcedure
      .input(z.object({ taskId: z.number() }))
      .query(async ({ input }) => {
        return db.getTaskAgentLogs(input.taskId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
