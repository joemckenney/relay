import Elysia, { t } from "elysia";
import { config } from "../../config.js";
import { getTiers } from "../../providers/index.js";

export const configRoutes = new Elysia({ prefix: "/v1" }).get(
  "/config",
  () => ({
    provider: {
      name: "ollama",
      baseUrl: config.ollama.baseUrl,
    },
    tiers: getTiers(),
    auth: {
      localBypass: config.auth.localBypass,
      keyRequired: !!config.auth.apiKey,
    },
  }),
  {
    detail: {
      operationId: "getConfig",
      description: "Get relay configuration",
      tags: ["config"],
    },
    response: {
      200: t.Object({
        provider: t.Object({
          name: t.String(),
          baseUrl: t.String(),
        }),
        tiers: t.Record(t.String(), t.String()),
        auth: t.Object({
          localBypass: t.Boolean(),
          keyRequired: t.Boolean(),
        }),
      }),
    },
  },
);
