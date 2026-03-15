import { eq, desc, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser, users, projects, tasks, agentLogs, meetingMessages, messageFeedback,
  type InsertProject, type InsertTask, type InsertAgentLog, type InsertMeetingMessage, type InsertMessageFeedback,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Project Queries ───

export async function createProject(data: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(projects).values(data);
  return { id: result[0].insertId };
}

export async function getUserProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt));
}

export async function getProjectById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId))).limit(1);
  return result[0];
}

export async function updateProject(id: number, userId: number, data: Partial<Pick<InsertProject, 'name' | 'description' | 'status' | 'agentConfig'>>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(projects).set(data).where(and(eq(projects.id, id), eq(projects.userId, userId)));
}

export async function deleteProject(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, userId)));
}

// ─── Task Queries ───

export async function createTask(data: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(tasks).values(data);
  return { id: result[0].insertId };
}

export async function getProjectTasks(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tasks).where(and(eq(tasks.projectId, projectId), eq(tasks.userId, userId))).orderBy(desc(tasks.createdAt));
}

export async function getTaskById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId))).limit(1);
  return result[0];
}

export async function updateTask(
  id: number,
  data: Partial<Pick<InsertTask, 'status' | 'currentPhase' | 'result' | 'startedAt' | 'completedAt' | 'requirementsBrief' | 'meetingRound'>>,
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(tasks).set(data).where(eq(tasks.id, id));
}

// ─── Agent Log Queries ───

export async function createAgentLog(data: InsertAgentLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(agentLogs).values(data);
  return { id: result[0].insertId };
}

export async function getTaskAgentLogs(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(agentLogs).where(eq(agentLogs.taskId, taskId)).orderBy(agentLogs.createdAt);
}

// ─── Meeting Message Queries ───

export async function createMeetingMessage(data: InsertMeetingMessage) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(meetingMessages).values(data);
  return { id: result[0].insertId };
}

export async function getTaskMeetingMessages(taskId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(meetingMessages).where(eq(meetingMessages.taskId, taskId)).orderBy(meetingMessages.createdAt);
}

// ─── Message Feedback Queries ───

export async function upsertMessageFeedback(data: InsertMessageFeedback) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Upsert: if user already rated this message, update the rating
  const existing = await db.select().from(messageFeedback)
    .where(and(eq(messageFeedback.messageId, data.messageId), eq(messageFeedback.userId, data.userId)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(messageFeedback)
      .set({ rating: data.rating })
      .where(eq(messageFeedback.id, existing[0].id));
    return { id: existing[0].id };
  }
  const result = await db.insert(messageFeedback).values(data);
  return { id: result[0].insertId };
}

export async function getMessageFeedbacks(messageIds: number[], userId: number) {
  const db = await getDb();
  if (!db) return [];
  if (messageIds.length === 0) return [];
  // Get all feedbacks for the given message IDs by this user
  const results = [];
  for (const msgId of messageIds) {
    const rows = await db.select().from(messageFeedback)
      .where(and(eq(messageFeedback.messageId, msgId), eq(messageFeedback.userId, userId)));
    results.push(...rows);
  }
  return results;
}
