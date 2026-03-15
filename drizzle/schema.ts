import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, bigint } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Projects — each user can create multiple PRISM projects
 */
export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  template: varchar("template", { length: 64 }).default("custom"),
  status: mysqlEnum("status", ["idle", "running", "completed", "failed"]).default("idle").notNull(),
  agentConfig: json("agentConfig"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

/**
 * Tasks — each project can have multiple tasks (pipeline runs)
 * 
 * Status flow:
 *   pending → clarifying (requirement meeting) → running (pipeline execution) → completed/failed
 *   pending → running (skip meeting / fast mode) → completed/failed
 */
export const tasks = mysqlTable("tasks", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  userId: int("userId").notNull(),
  prompt: text("prompt").notNull(),
  status: mysqlEnum("status", ["pending", "running", "clarifying", "completed", "failed"]).default("pending").notNull(),
  currentPhase: int("currentPhase").default(0),
  totalPhases: int("totalPhases").default(6),
  result: json("result"),
  /** Structured requirements brief generated after the meeting concludes */
  requirementsBrief: json("requirementsBrief"),
  /** Meeting round counter (0 = not started, 1 = Round 1 done, 2+ = follow-up rounds) */
  meetingRound: int("meetingRound").default(0),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

/**
 * Agent Logs — records each agent's activity during a task
 */
export const agentLogs = mysqlTable("agent_logs", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  agentName: varchar("agentName", { length: 64 }).notNull(),
  agentRole: varchar("agentRole", { length: 64 }).notNull(),
  phase: int("phase").default(0),
  action: varchar("action", { length: 128 }),
  content: text("content"),
  status: mysqlEnum("status", ["thinking", "working", "reviewing", "done", "error"]).default("thinking").notNull(),
  durationMs: int("durationMs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AgentLog = typeof agentLogs.$inferSelect;
export type InsertAgentLog = typeof agentLogs.$inferInsert;

/**
 * Meeting Messages — records the requirement meeting conversation
 * between user and agents (Conductor, Researcher, PM)
 * 
 * sender: "user" | "conductor" | "researcher" | "pm"
 */
export const meetingMessages = mysqlTable("meeting_messages", {
  id: int("id").autoincrement().primaryKey(),
  taskId: int("taskId").notNull(),
  sender: varchar("sender", { length: 32 }).notNull(),
  round: int("round").default(1).notNull(),
  content: text("content").notNull(),
  /** For agent messages: what type of analysis this is */
  messageType: varchar("messageType", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MeetingMessage = typeof meetingMessages.$inferSelect;
export type InsertMeetingMessage = typeof meetingMessages.$inferInsert;

/**
 * Message Feedback — records user satisfaction ratings on agent meeting messages
 * rating: "satisfied" | "unsatisfied"
 */
export const messageFeedback = mysqlTable("message_feedback", {
  id: int("id").autoincrement().primaryKey(),
  messageId: int("messageId").notNull(),
  userId: int("userId").notNull(),
  rating: mysqlEnum("rating", ["satisfied", "unsatisfied"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MessageFeedback = typeof messageFeedback.$inferSelect;
export type InsertMessageFeedback = typeof messageFeedback.$inferInsert;
