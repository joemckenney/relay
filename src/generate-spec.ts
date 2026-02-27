import { mkdir, writeFile } from "node:fs/promises";
import { app } from "./app.js";

const server = app.listen({ port: 0, hostname: "127.0.0.1" });
const port = server.server?.port;
if (!port) throw new Error("Failed to start server on ephemeral port");

try {
  const res = await fetch(`http://127.0.0.1:${port}/openapi/json`);
  const spec = await res.json();

  if (spec.paths?.["/v1/chat/completions"]?.post) {
    // x-fern-streaming: SSE format with [DONE] terminator
    spec.paths["/v1/chat/completions"].post["x-fern-streaming"] = {
      format: "sse",
      terminator: "[DONE]",
      "stream-condition": "$request.stream",
      response: {
        $ref: "#/components/schemas/ChatCompletion",
      },
      "response-stream": {
        $ref: "#/components/schemas/ChatCompletionChunk",
      },
    };

    // Reusable tool_calls schema
    const toolCallSchema = {
      type: "array",
      items: {
        type: "object",
        required: ["id", "type", "function"],
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: ["function"] },
          function: {
            type: "object",
            required: ["name", "arguments"],
            properties: {
              name: { type: "string" },
              arguments: { type: "string" },
            },
          },
        },
      },
    };

    // Non-streaming response schema
    spec.components.schemas.ChatCompletion = {
      type: "object",
      required: ["id", "object", "created", "model", "choices", "usage"],
      properties: {
        id: { type: "string" },
        object: { type: "string", enum: ["chat.completion"] },
        created: { type: "number" },
        model: { type: "string" },
        choices: {
          type: "array",
          items: {
            type: "object",
            required: ["index", "message", "finish_reason"],
            properties: {
              index: { type: "number" },
              message: {
                type: "object",
                required: ["role"],
                properties: {
                  role: {
                    type: "string",
                    enum: ["assistant"],
                  },
                  content: {
                    type: "string",
                    nullable: true,
                  },
                  tool_calls: toolCallSchema,
                },
              },
              finish_reason: {
                type: "string",
                enum: ["stop", "length", "tool_calls"],
              },
            },
          },
        },
        usage: {
          type: "object",
          required: ["prompt_tokens", "completion_tokens", "total_tokens"],
          properties: {
            prompt_tokens: { type: "number" },
            completion_tokens: { type: "number" },
            total_tokens: { type: "number" },
          },
        },
      },
    };

    // Streaming chunk schema
    spec.components.schemas.ChatCompletionChunk = {
      type: "object",
      required: ["id", "object", "created", "model", "choices"],
      properties: {
        id: { type: "string" },
        object: {
          type: "string",
          enum: ["chat.completion.chunk"],
        },
        created: { type: "number" },
        model: { type: "string" },
        choices: {
          type: "array",
          items: {
            type: "object",
            required: ["index", "delta", "finish_reason"],
            properties: {
              index: { type: "number" },
              delta: {
                type: "object",
                properties: {
                  content: { type: "string" },
                  tool_calls: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["index", "id", "type", "function"],
                      properties: {
                        index: { type: "number" },
                        id: { type: "string" },
                        type: {
                          type: "string",
                          enum: ["function"],
                        },
                        function: {
                          type: "object",
                          required: ["name", "arguments"],
                          properties: {
                            name: {
                              type: "string",
                            },
                            arguments: {
                              type: "string",
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              finish_reason: {
                type: "string",
                nullable: true,
                enum: ["stop", "length", "tool_calls", null],
              },
            },
          },
        },
      },
    };
  }

  await mkdir("./spec", { recursive: true });
  await writeFile("./spec/openapi.json", JSON.stringify(spec, null, 2));
  console.log("OpenAPI spec generated: ./spec/openapi.json");
} finally {
  server.stop();
}
