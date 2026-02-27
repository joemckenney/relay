import Elysia, { t } from "elysia";
import { getModelList, getTiers } from "../../providers/index.js";

export const modelRoutes = new Elysia({ prefix: "/v1" })
  .get(
    "/models",
    () => {
      const models = getModelList();
      return {
        object: "list" as const,
        data: models.map((m) => ({
          id: m.id,
          object: "model" as const,
          created: 0,
          owned_by: "ollama",
        })),
      };
    },
    {
      detail: {
        operationId: "listModels",
        description: "List available models (OpenAI-compatible format)",
        tags: ["models"],
      },
      response: {
        200: t.Object({
          object: t.Literal("list"),
          data: t.Array(
            t.Object({
              id: t.String(),
              object: t.Literal("model"),
              created: t.Number(),
              owned_by: t.String(),
            }),
          ),
        }),
      },
    },
  )
  .get("/models/tiers", () => ({ tiers: getTiers() }), {
    detail: {
      operationId: "listModelTiers",
      description: "List tier-to-model mappings",
      tags: ["models"],
    },
    response: {
      200: t.Object({
        tiers: t.Record(t.String(), t.String()),
      }),
    },
  });
