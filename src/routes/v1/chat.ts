import { type CoreMessage, generateText, jsonSchema, streamText } from "ai";
import Elysia, { t } from "elysia";
import { resolveModel } from "../../providers/index.js";

// --- Message schemas (OpenAI wire format) ---

const SystemMessage = t.Object({
  role: t.Literal("system"),
  content: t.String(),
});

const UserMessage = t.Object({
  role: t.Literal("user"),
  content: t.String(),
});

const ToolCallFunction = t.Object({
  name: t.String(),
  arguments: t.String(),
});

const ToolCallItem = t.Object({
  id: t.String(),
  type: t.Literal("function"),
  function: ToolCallFunction,
});

const AssistantMessage = t.Object({
  role: t.Literal("assistant"),
  content: t.Optional(t.Union([t.String(), t.Null()])),
  tool_calls: t.Optional(t.Array(ToolCallItem)),
});

const ToolMessage = t.Object({
  role: t.Literal("tool"),
  content: t.String(),
  tool_call_id: t.String(),
});

const MessageSchema = t.Union([
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ToolMessage,
]);

// --- Tool / tool_choice schemas ---

const FunctionDef = t.Object({
  name: t.String(),
  description: t.Optional(t.String()),
  parameters: t.Optional(t.Any()),
});

const ToolDef = t.Object({
  type: t.Literal("function"),
  function: FunctionDef,
});

const ChatCompletionBody = t.Object({
  model: t.String({
    description: "Model name or tier alias (small/medium/large)",
  }),
  messages: t.Array(MessageSchema, { minItems: 1 }),
  stream: t.Optional(t.Boolean({ default: false })),
  temperature: t.Optional(t.Number({ minimum: 0, maximum: 2 })),
  max_tokens: t.Optional(t.Number({ minimum: 1 })),
  tools: t.Optional(t.Array(ToolDef)),
  tool_choice: t.Optional(
    t.Union([
      t.Literal("auto"),
      t.Literal("none"),
      t.Literal("required"),
      t.Object({
        type: t.Literal("function"),
        function: t.Object({ name: t.String() }),
      }),
    ]),
  ),
});

// --- Conversion helpers ---

type OpenAIMessage = (typeof MessageSchema)["static"];
type OpenAITool = (typeof ToolDef)["static"];
type OpenAIToolChoice = (typeof ChatCompletionBody)["static"]["tool_choice"];

function convertMessages(messages: OpenAIMessage[]): CoreMessage[] {
  return messages.map((msg): CoreMessage => {
    switch (msg.role) {
      case "system":
        return { role: "system", content: msg.content };
      case "user":
        return { role: "user", content: msg.content };
      case "assistant": {
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          return {
            role: "assistant",
            content: msg.tool_calls.map((tc) => ({
              type: "tool-call" as const,
              toolCallId: tc.id,
              toolName: tc.function.name,
              args: JSON.parse(tc.function.arguments),
            })),
          };
        }
        return { role: "assistant", content: msg.content ?? "" };
      }
      case "tool":
        return {
          role: "tool",
          content: [
            {
              type: "tool-result" as const,
              toolCallId: msg.tool_call_id,
              toolName: "",
              result: msg.content,
            },
          ],
        };
      default:
        throw new Error(
          `Unsupported message role: ${(msg as { role: string }).role}`,
        );
    }
  });
}

function convertTools(
  tools: OpenAITool[],
): Record<string, { description?: string; parameters: unknown }> {
  const result: Record<string, { description?: string; parameters: unknown }> =
    {};
  for (const tool of tools) {
    result[tool.function.name] = {
      description: tool.function.description,
      parameters: jsonSchema(tool.function.parameters ?? { type: "object" }),
    };
  }
  return result;
}

function convertToolChoice(
  choice: NonNullable<OpenAIToolChoice>,
): "auto" | "none" | "required" | { type: "tool"; toolName: string } {
  if (typeof choice === "string") {
    return choice;
  }
  return { type: "tool", toolName: choice.function.name };
}

// --- Helpers ---

function generateId() {
  return `chatcmpl-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

// --- Route ---

export const chatRoutes = new Elysia({ prefix: "/v1" }).post(
  "/chat/completions",
  async ({ body }) => {
    const {
      model: modelOrTier,
      messages,
      stream,
      temperature,
      max_tokens,
      tools,
      tool_choice,
    } = body;

    const convertedMessages = convertMessages(messages);

    if (stream) {
      const model = resolveModel(modelOrTier);
      const result = streamText({
        model,
        messages: convertedMessages,
        temperature,
        maxTokens: max_tokens,
        ...(tools && { tools: convertTools(tools) }),
        ...(tool_choice && {
          toolChoice: convertToolChoice(tool_choice),
        }),
      });

      const completionId = generateId();
      const created = Math.floor(Date.now() / 1000);
      const encoder = new TextEncoder();

      const readable = new ReadableStream({
        async start(controller) {
          try {
            let toolIndex = 0;
            let finishReason: string | null = null;

            for await (const part of result.fullStream) {
              switch (part.type) {
                case "text-delta":
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        id: completionId,
                        object: "chat.completion.chunk",
                        created,
                        model: modelOrTier,
                        choices: [
                          {
                            index: 0,
                            delta: {
                              content: part.textDelta,
                            },
                            finish_reason: null,
                          },
                        ],
                      })}\n\n`,
                    ),
                  );
                  break;
                case "tool-call":
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        id: completionId,
                        object: "chat.completion.chunk",
                        created,
                        model: modelOrTier,
                        choices: [
                          {
                            index: 0,
                            delta: {
                              tool_calls: [
                                {
                                  index: toolIndex++,
                                  id: part.toolCallId,
                                  type: "function",
                                  function: {
                                    name: part.toolName,
                                    arguments: JSON.stringify(part.args),
                                  },
                                },
                              ],
                            },
                            finish_reason: null,
                          },
                        ],
                      })}\n\n`,
                    ),
                  );
                  break;
                case "finish":
                  finishReason =
                    part.finishReason === "tool-calls"
                      ? "tool_calls"
                      : part.finishReason === "length"
                        ? "length"
                        : "stop";
                  break;
              }
            }

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  id: completionId,
                  object: "chat.completion.chunk",
                  created,
                  model: modelOrTier,
                  choices: [
                    {
                      index: 0,
                      delta: {},
                      finish_reason: finishReason ?? "stop",
                    },
                  ],
                })}\n\n`,
              ),
            );
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          } catch (error) {
            console.error("Stream error:", error);
          } finally {
            controller.close();
          }
        },
      });

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    // NON-STREAMING RESPONSE PATH
    const model = resolveModel(modelOrTier);
    const result = await generateText({
      model,
      messages: convertedMessages,
      temperature,
      maxTokens: max_tokens,
      ...(tools && { tools: convertTools(tools) }),
      ...(tool_choice && {
        toolChoice: convertToolChoice(tool_choice),
      }),
    });

    const hasToolCalls = result.toolCalls && result.toolCalls.length > 0;

    return {
      id: generateId(),
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: modelOrTier,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: result.text || null,
            ...(hasToolCalls && {
              tool_calls: result.toolCalls.map((tc) => ({
                id: tc.toolCallId,
                type: "function" as const,
                function: {
                  name: tc.toolName,
                  arguments: JSON.stringify(tc.args),
                },
              })),
            }),
          },
          finish_reason: hasToolCalls
            ? "tool_calls"
            : result.finishReason === "length"
              ? "length"
              : "stop",
        },
      ],
      usage: {
        prompt_tokens: result.usage?.promptTokens ?? 0,
        completion_tokens: result.usage?.completionTokens ?? 0,
        total_tokens:
          (result.usage?.promptTokens ?? 0) +
          (result.usage?.completionTokens ?? 0),
      },
    };
  },
  {
    detail: {
      operationId: "createChatCompletion",
      description: "Create a chat completion (streaming or non-streaming)",
      tags: ["chat"],
    },
    body: ChatCompletionBody,
  },
);
