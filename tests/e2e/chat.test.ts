import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { RelayClient } from "../../sdk/typescript/index.js";
import { app } from "../../src/app.js";

let client: RelayClient;
let server: ReturnType<typeof app.listen>;

beforeAll(() => {
  server = app.listen({ port: 0, hostname: "127.0.0.1" });
  const port = server.server?.port;
  client = new RelayClient({
    baseUrl: `http://127.0.0.1:${port}`,
    timeoutInSeconds: 120,
  });
});

afterAll(() => {
  server.stop();
});

describe("non-streaming chat completion", () => {
  test("returns a completion using tier alias", async () => {
    const result = await client.chat.createChatCompletion({
      model: "small",
      messages: [{ role: "user", content: "Reply with only the word 'pong'" }],
    });

    expect(result.id).toMatch(/^chatcmpl-/);
    expect(result.object).toBe("chat.completion");
    expect(result.choices.length).toBe(1);
    expect(result.choices[0].message.content.length).toBeGreaterThan(0);
    expect(result.choices[0].message.role).toBe("assistant");
  }, 60_000);

  test("returns a completion using explicit model name", async () => {
    const result = await client.chat.createChatCompletion({
      model: "qwen2.5:7b",
      messages: [{ role: "user", content: "Reply with only the word 'pong'" }],
    });

    expect(result.choices[0].message.content.length).toBeGreaterThan(0);
  }, 60_000);

  test("respects max_tokens", async () => {
    const result = await client.chat.createChatCompletion({
      model: "small",
      messages: [
        { role: "user", content: "Write a long essay about the ocean" },
      ],
      max_tokens: 5,
    });

    const wordCount = result.choices[0].message.content
      .trim()
      .split(/\s+/).length;
    expect(wordCount).toBeLessThanOrEqual(15);
  }, 60_000);

  test("supports system messages", async () => {
    const result = await client.chat.createChatCompletion({
      model: "small",
      messages: [
        {
          role: "system",
          content: "You only respond with the single word 'banana'",
        },
        { role: "user", content: "Say something" },
      ],
      max_tokens: 10,
    });

    expect(result.choices[0].message.content.toLowerCase()).toContain("banana");
  }, 60_000);

  test("includes model name in response", async () => {
    const result = await client.chat.createChatCompletion({
      model: "small",
      messages: [{ role: "user", content: "Reply with only the word 'pong'" }],
    });

    expect(result.model).toBe("small");
  }, 60_000);

  test("includes a unix timestamp", async () => {
    const before = Math.floor(Date.now() / 1000);
    const result = await client.chat.createChatCompletion({
      model: "small",
      messages: [{ role: "user", content: "Reply with only the word 'pong'" }],
    });
    const after = Math.floor(Date.now() / 1000);

    expect(result.created).toBeGreaterThanOrEqual(before);
    expect(result.created).toBeLessThanOrEqual(after);
  }, 60_000);

  test("includes token usage", async () => {
    const result = await client.chat.createChatCompletion({
      model: "small",
      messages: [{ role: "user", content: "Reply with only the word 'pong'" }],
    });

    expect(result.usage.prompt_tokens).toBeGreaterThan(0);
    expect(result.usage.completion_tokens).toBeGreaterThan(0);
    expect(result.usage.total_tokens).toBe(
      result.usage.prompt_tokens + result.usage.completion_tokens,
    );
  }, 60_000);

  test("finish_reason is stop for normal completion", async () => {
    const result = await client.chat.createChatCompletion({
      model: "small",
      messages: [{ role: "user", content: "Reply with only the word 'pong'" }],
    });

    expect(result.choices[0].finish_reason).toBe("stop");
  }, 60_000);
});

describe("streaming chat completion", () => {
  test("streams chunks with content deltas", async () => {
    const stream = await client.chat.createChatCompletionStream({
      model: "small",
      messages: [{ role: "user", content: "Reply with only the word 'pong'" }],
    });

    const chunks: string[] = [];
    for await (const chunk of stream) {
      if (chunk.choices?.[0]?.delta?.content) {
        chunks.push(chunk.choices[0].delta.content);
      }
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join("").length).toBeGreaterThan(0);
  }, 60_000);

  test("final chunk has finish_reason stop", async () => {
    const stream = await client.chat.createChatCompletionStream({
      model: "small",
      messages: [{ role: "user", content: "Reply with only the word 'pong'" }],
    });

    let lastChunk: { choices?: { finish_reason?: string | null }[] } | null =
      null;
    for await (const chunk of stream) {
      lastChunk = chunk;
    }

    expect(lastChunk).not.toBeNull();
    expect(lastChunk?.choices?.[0]?.finish_reason).toBe("stop");
  }, 60_000);

  test("all chunks share the same completion id", async () => {
    const stream = await client.chat.createChatCompletionStream({
      model: "small",
      messages: [{ role: "user", content: "Reply with only the word 'pong'" }],
    });

    const ids = new Set<string>();
    for await (const chunk of stream) {
      if (chunk.id) ids.add(chunk.id);
    }

    expect(ids.size).toBe(1);
    const [id] = ids;
    expect(id).toMatch(/^chatcmpl-/);
  }, 60_000);

  test("streaming produces the same answer as non-streaming", async () => {
    const messages: { role: "user"; content: string }[] = [
      { role: "user", content: "What is 2+2? Reply with only the number." },
    ];

    const [nonStream, streamedText] = await Promise.all([
      client.chat.createChatCompletion({
        model: "small",
        messages,
        temperature: 0,
        max_tokens: 5,
      }),
      (async () => {
        const stream = await client.chat.createChatCompletionStream({
          model: "small",
          messages,
          temperature: 0,
          max_tokens: 5,
        });
        const parts: string[] = [];
        for await (const chunk of stream) {
          if (chunk.choices?.[0]?.delta?.content) {
            parts.push(chunk.choices[0].delta.content);
          }
        }
        return parts.join("");
      })(),
    ]);

    // Both should contain "4"
    expect(nonStream.choices[0].message.content).toContain("4");
    expect(streamedText).toContain("4");
  }, 120_000);
});

const weatherTool = {
  type: "function" as const,
  function: {
    name: "get_weather",
    description: "Get current weather for a location",
    parameters: {
      type: "object",
      properties: { location: { type: "string" } },
      required: ["location"],
    },
  },
};

describe("tool calling", () => {
  test("non-streaming tool call with tool_choice required", async () => {
    const result = await client.chat.createChatCompletion({
      model: "small",
      messages: [
        { role: "user", content: "What is the weather in San Francisco?" },
      ],
      tools: [weatherTool],
      tool_choice: "required",
    });

    expect(result.choices[0].finish_reason).toBe("tool_calls");
    expect(result.choices[0].message.tool_calls?.length).toBeGreaterThan(0);
    expect(result.choices[0].message.tool_calls?.[0]?.function.name).toBe(
      "get_weather",
    );
    const args = JSON.parse(
      result.choices[0].message.tool_calls?.[0]?.function.arguments ?? "{}",
    );
    expect(args).toHaveProperty("location");
  }, 60_000);

  test("multi-turn with tool result", async () => {
    // Step 1: initial call that triggers a tool call
    const first = await client.chat.createChatCompletion({
      model: "small",
      messages: [
        { role: "user", content: "What is the weather in San Francisco?" },
      ],
      tools: [weatherTool],
      tool_choice: "required",
    });

    const tcs = first.choices[0].message.tool_calls;
    expect(tcs?.length).toBeGreaterThan(0);
    const tc = tcs?.[0];

    // Step 2: send back the assistant tool_calls message + tool result
    const second = await client.chat.createChatCompletion({
      model: "small",
      messages: [
        { role: "user", content: "What is the weather in San Francisco?" },
        {
          role: "assistant",
          tool_calls: [
            {
              id: tc?.id ?? "",
              type: "function",
              function: {
                name: tc?.function.name ?? "",
                arguments: tc?.function.arguments ?? "{}",
              },
            },
          ],
        },
        {
          role: "tool",
          content: JSON.stringify({ temperature: 62, condition: "foggy" }),
          tool_call_id: tc?.id ?? "",
        },
      ],
    });

    // Model should produce a text response referencing the tool result
    expect(second.choices[0].message.content?.length).toBeGreaterThan(0);
    expect(second.choices[0].finish_reason).toBe("stop");
  }, 120_000);

  test("tool_choice none returns text only", async () => {
    const result = await client.chat.createChatCompletion({
      model: "small",
      messages: [{ role: "user", content: "What is the weather?" }],
      tools: [weatherTool],
      tool_choice: "none",
    });

    expect(result.choices[0].message.tool_calls).toBeUndefined();
    expect(result.choices[0].message.content?.length).toBeGreaterThan(0);
  }, 60_000);

  test("streaming tool call with tool_choice required", async () => {
    const stream = await client.chat.createChatCompletionStream({
      model: "small",
      messages: [{ role: "user", content: "What is the weather in Tokyo?" }],
      tools: [weatherTool],
      tool_choice: "required",
    });

    const toolCallChunks: unknown[] = [];
    let lastFinishReason: string | null | undefined = null;

    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta;
      if (delta?.tool_calls) {
        toolCallChunks.push(...delta.tool_calls);
      }
      if (chunk.choices?.[0]?.finish_reason) {
        lastFinishReason = chunk.choices[0].finish_reason;
      }
    }

    expect(toolCallChunks.length).toBeGreaterThan(0);
    expect(lastFinishReason).toBe("tool_calls");
  }, 60_000);
});
