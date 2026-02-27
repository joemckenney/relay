import { openapi } from "@elysiajs/openapi";
import Elysia from "elysia";
import { config } from "./config.js";
import { auth } from "./middleware/auth.js";
import { healthRoutes } from "./routes/health.js";
import { chatRoutes } from "./routes/v1/chat.js";
import { configRoutes } from "./routes/v1/config.js";
import { modelRoutes } from "./routes/v1/models.js";

export const app = new Elysia()
  .use(
    openapi({
      documentation: {
        info: {
          title: "Relay — AI Model Gateway",
          description: "Local AI model gateway wrapping ollama-hosted models",
          version: "1.0.0",
        },
        servers: [
          {
            url: `http://localhost:${config.port}`,
            description: "Development server",
          },
        ],
      },
    }),
  )
  .use(auth)
  .use(healthRoutes)
  .use(modelRoutes)
  .use(configRoutes)
  .use(chatRoutes);
