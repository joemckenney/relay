import { generateText, streamText } from "ai";
import Elysia, { t } from "elysia";
import { resolveModel } from "../../providers/index.js";

const MessageSchema = t.Object({
  role: t.Union([
    t.Literal("system"),
    t.Literal("user"),
    t.Literal("assistant"),
  ]),
  content: t.String(),
});

const ChatCompletionBody = t.Object({
  model: t.String({
    description: "Model name or tier alias (small/medium/large)",
  }),
  messages: t.Array(MessageSchema, { minItems: 1 }),
  stream: t.Optional(t.Boolean({ default: false })),
  temperature: t.Optional(t.Number({ minimum: 0, maximum: 2 })),
  max_tokens: t.Optional(t.Number({ minimum: 1 })),
});

function generateId() {
  return `chatcmpl-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

export const chatRoutes = new Elysia({ prefix: "/v1" }).post(
  "/chat/completions",
  async ({ body }) => {
    const {
      model: modelOrTier,
      messages,
      stream,
      temperature,
      max_tokens,
    } = body;

    if (stream) {
      const model = resolveModel(modelOrTier);
      const result = streamText({
        model,
        messages,
        temperature,
        maxTokens: max_tokens,
      });

      const completionId = generateId();
      const created = Math.floor(Date.now() / 1000);
      const encoder = new TextEncoder();

      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const textPart of result.textStream) {
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
                        delta: { content: textPart },
                        finish_reason: null,
                      },
                    ],
                  })}\n\n`,
                ),
              );
            }

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  id: completionId,
                  object: "chat.completion.chunk",
                  created,
                  model: modelOrTier,
                  choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
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

    const model = resolveModel(modelOrTier);
    const result = await generateText({
      model,
      messages,
      temperature,
      maxTokens: max_tokens,
    });

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
            content: result.text,
          },
          finish_reason: result.finishReason === "length" ? "length" : "stop",
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
