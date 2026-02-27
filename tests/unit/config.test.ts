import { describe, expect, test } from "bun:test";
import { config } from "../../src/config.js";

describe("config", () => {
  test("port is a positive number", () => {
    expect(typeof config.port).toBe("number");
    expect(config.port).toBeGreaterThan(0);
  });

  test("host is a non-empty string", () => {
    expect(typeof config.host).toBe("string");
    expect(config.host.length).toBeGreaterThan(0);
  });

  test("ollama baseUrl points to port 11434", () => {
    expect(config.ollama.baseUrl).toContain("11434");
  });

  test("all three model tiers are defined", () => {
    expect(config.models.small).toBeDefined();
    expect(config.models.medium).toBeDefined();
    expect(config.models.large).toBeDefined();
  });

  test("auth.localBypass is a boolean", () => {
    expect(typeof config.auth.localBypass).toBe("boolean");
  });

  test("auth.apiKey is a string", () => {
    expect(typeof config.auth.apiKey).toBe("string");
  });
});
