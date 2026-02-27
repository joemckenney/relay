import { describe, expect, test } from "bun:test";
import {
  getModelList,
  getTiers,
  resolveModel,
} from "../../src/providers/index.js";

describe("getTiers", () => {
  test("returns all three tiers", () => {
    const tiers = getTiers();
    expect(tiers).toHaveProperty("small");
    expect(tiers).toHaveProperty("medium");
    expect(tiers).toHaveProperty("large");
  });

  test("returns a shallow copy", () => {
    const a = getTiers();
    const b = getTiers();
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  test("tier values are non-empty strings", () => {
    for (const value of Object.values(getTiers())) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
    }
  });
});

describe("getModelList", () => {
  test("returns at least one model", () => {
    expect(getModelList().length).toBeGreaterThanOrEqual(1);
  });

  test("each model has an id", () => {
    for (const model of getModelList()) {
      expect(typeof model.id).toBe("string");
      expect(model.id.length).toBeGreaterThan(0);
    }
  });

  test("deduplicates models with the same id", () => {
    const ids = getModelList().map((m) => m.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  test("first model has a tier annotation", () => {
    expect(getModelList()[0].tier).toBeDefined();
  });
});

describe("resolveModel", () => {
  test("resolves tier alias to the configured model", () => {
    const model = resolveModel("small");
    expect(model.modelId).toBe(getTiers().small);
  });

  test("passes through explicit model names", () => {
    const model = resolveModel("qwen2.5:7b");
    expect(model.modelId).toBe("qwen2.5:7b");
  });

  test("passes through unknown names without error", () => {
    const model = resolveModel("nonexistent-model");
    expect(model.modelId).toBe("nonexistent-model");
  });
});
