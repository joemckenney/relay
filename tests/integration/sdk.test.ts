import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { RelayClient } from "../../sdk/typescript/index.js";
import { app } from "../../src/app.js";

let client: RelayClient;
let server: ReturnType<typeof app.listen>;

beforeAll(() => {
  server = app.listen({ port: 0, hostname: "127.0.0.1" });
  const port = server.server?.port;
  client = new RelayClient({ baseUrl: `http://127.0.0.1:${port}` });
});

afterAll(() => {
  server.stop();
});

describe("health", () => {
  test("check returns status ok", async () => {
    const health = await client.health.check();
    expect(health.status).toBe("ok");
  });

  test("check returns uptime >= 0", async () => {
    const health = await client.health.check();
    expect(health.uptime).toBeGreaterThanOrEqual(0);
  });

  test("check returns a valid ISO timestamp", async () => {
    const health = await client.health.check();
    const parsed = new Date(health.timestamp);
    expect(parsed.getTime()).not.toBeNaN();
  });
});

describe("models", () => {
  test("listModels returns OpenAI-compatible list", async () => {
    const models = await client.models.listModels();
    expect(models.object).toBe("list");
    expect(models.data.length).toBeGreaterThanOrEqual(1);
  });

  test("listModels includes qwen2.5:7b", async () => {
    const models = await client.models.listModels();
    const ids = models.data.map((m) => m.id);
    expect(ids).toContain("qwen2.5:7b");
  });

  test("each model has required fields", async () => {
    const models = await client.models.listModels();
    for (const model of models.data) {
      expect(typeof model.id).toBe("string");
      expect(model.object).toBe("model");
      expect(typeof model.created).toBe("number");
      expect(typeof model.owned_by).toBe("string");
    }
  });

  test("listModelTiers returns all three tiers", async () => {
    const result = await client.models.listModelTiers();
    const tiers = result.tiers as Record<string, string>;
    expect(tiers.small).toBeDefined();
    expect(tiers.medium).toBeDefined();
    expect(tiers.large).toBeDefined();
  });
});

describe("config", () => {
  test("getConfig returns provider info", async () => {
    const cfg = await client.config.getConfig();
    expect(cfg.provider.name).toBe("ollama");
    expect(cfg.provider.baseUrl).toContain("11434");
  });

  test("getConfig includes tier mappings", async () => {
    const cfg = await client.config.getConfig();
    const tiers = cfg.tiers as Record<string, string>;
    expect(tiers.small).toBeDefined();
    expect(tiers.medium).toBeDefined();
    expect(tiers.large).toBeDefined();
  });

  test("getConfig includes auth settings", async () => {
    const cfg = await client.config.getConfig();
    expect(typeof cfg.auth.localBypass).toBe("boolean");
    expect(typeof cfg.auth.keyRequired).toBe("boolean");
  });
});
