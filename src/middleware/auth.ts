import Elysia from "elysia";
import { config } from "../config.js";

const EXEMPT_PATHS = ["/health", "/openapi", "/openapi/json"];

function isLocal(request: Request): boolean {
  const url = new URL(request.url);
  const host = url.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export const auth = new Elysia({ name: "auth" }).onBeforeHandle(
  ({ request, set }) => {
    const url = new URL(request.url);
    if (EXEMPT_PATHS.some((p) => url.pathname.startsWith(p))) {
      return;
    }

    if (config.auth.localBypass && isLocal(request)) {
      return;
    }

    if (!config.auth.apiKey) {
      return;
    }

    const header = request.headers.get("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

    if (token !== config.auth.apiKey) {
      set.status = 401;
      return { error: "Unauthorized" };
    }
  },
);
