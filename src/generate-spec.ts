import { mkdir, writeFile } from "node:fs/promises";
import { app } from "./app.js";

const server = app.listen({ port: 0, hostname: "127.0.0.1" });
const port = server.server?.port;
if (!port) throw new Error("Failed to start server on ephemeral port");

try {
  const res = await fetch(`http://127.0.0.1:${port}/openapi/json`);
  const spec = await res.json();

  // Add x-fern-streaming extension to the chat completions endpoint
  if (spec.paths?.["/v1/chat/completions"]?.post) {
    spec.paths["/v1/chat/completions"].post["x-fern-streaming"] = {
      "stream-condition": "stream",
      response: {
        $ref: "#/components/schemas/ChatCompletionChunk",
      },
      "response-stream": {
        $ref: "#/components/schemas/ChatCompletionChunk",
      },
    };

    // Add the chunk schema for Fern streaming
    spec.components.schemas.ChatCompletionChunk = {
      type: "object",
      required: ["id", "object", "created", "model", "choices"],
      properties: {
        id: { type: "string" },
        object: { type: "string", enum: ["chat.completion.chunk"] },
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
                },
              },
              finish_reason: {
                type: "string",
                nullable: true,
                enum: ["stop", "length", null],
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
