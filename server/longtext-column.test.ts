/**
 * Tests for Bugfix — agent_logs.content and meeting_messages.content longtext migration
 *
 * Validates that the content columns use longtext (up to ~4GB) instead of text (~64KB),
 * preventing truncation of large LLM outputs.
 *
 * Drizzle uses columnType "MySqlText" for all text variants; the actual SQL type
 * is distinguished by the `config.textType` field ("text" | "longtext" | "mediumtext" | "tinytext").
 */
import { describe, it, expect } from "vitest";
import { agentLogs, meetingMessages } from "../drizzle/schema";

describe("longtext column migration", () => {
  it("agent_logs.content column uses longtext type", () => {
    const col = agentLogs.content;
    expect((col as any).config.textType).toBe("longtext");
  });

  it("meeting_messages.content column uses longtext type", () => {
    const col = meetingMessages.content;
    expect((col as any).config.textType).toBe("longtext");
  });

  it("agent_logs.content column name is 'content'", () => {
    expect(agentLogs.content.name).toBe("content");
  });

  it("meeting_messages.content column name is 'content'", () => {
    expect(meetingMessages.content.name).toBe("content");
  });
});
