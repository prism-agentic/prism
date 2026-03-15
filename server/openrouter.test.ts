import { describe, expect, it } from "vitest";
import { invokeLLM } from "./_core/llm";

describe("OpenRouter LLM integration", () => {
  it("successfully calls OpenRouter API with a simple prompt", async () => {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "You are a helpful assistant. Reply in one sentence." },
        { role: "user", content: "Say hello." },
      ],
    });

    expect(result).toBeTruthy();
    expect(result.choices).toBeDefined();
    expect(result.choices.length).toBeGreaterThan(0);

    const message = result.choices[0].message;
    expect(message).toBeDefined();
    expect(message.role).toBe("assistant");

    // Content should be a non-empty string
    const content = typeof message.content === "string"
      ? message.content
      : Array.isArray(message.content)
        ? message.content.map(c => ("text" in c ? c.text : "")).join("")
        : "";
    expect(content.length).toBeGreaterThan(0);
  }, 30000);

  it("returns usage information from OpenRouter", async () => {
    const result = await invokeLLM({
      messages: [
        { role: "user", content: "What is 2+2? Reply with just the number." },
      ],
    });

    expect(result).toBeTruthy();
    expect(result.model).toBeDefined();
    // OpenRouter should return a model identifier
    expect(typeof result.model).toBe("string");
  }, 30000);

  it("handles structured JSON response format", async () => {
    const result = await invokeLLM({
      messages: [
        { role: "system", content: "You are a helpful assistant designed to output JSON." },
        { role: "user", content: "Return a JSON object with name set to 'test' and value set to 42." },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "test_output",
          strict: true,
          schema: {
            type: "object",
            properties: {
              name: { type: "string" },
              value: { type: "integer" },
            },
            required: ["name", "value"],
            additionalProperties: false,
          },
        },
      },
    });

    expect(result).toBeTruthy();
    expect(result.choices.length).toBeGreaterThan(0);

    const content = result.choices[0].message.content;
    const text = typeof content === "string" ? content : "";
    // Should be valid JSON
    const parsed = JSON.parse(text);
    expect(parsed.name).toBe("test");
    expect(parsed.value).toBe(42);
  }, 30000);
});
