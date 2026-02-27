import Elysia, { t } from "elysia";

const startedAt = Date.now();

export const healthRoutes = new Elysia().get(
  "/health",
  () => ({
    status: "ok" as const,
    uptime: Math.floor((Date.now() - startedAt) / 1000),
    timestamp: new Date().toISOString(),
  }),
  {
    detail: {
      operationId: "healthCheck",
      description: "Health check endpoint",
      tags: ["health"],
    },
    response: {
      200: t.Object({
        status: t.Literal("ok"),
        uptime: t.Number({ description: "Uptime in seconds" }),
        timestamp: t.String({ description: "Current timestamp" }),
      }),
    },
  },
);
