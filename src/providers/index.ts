import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { config, type ModelTier } from "../config.js";

export const ollama = createOpenAICompatible({
  name: "ollama",
  baseURL: config.ollama.baseUrl,
});

const tiers: Record<ModelTier, string> = {
  small: config.models.small,
  medium: config.models.medium,
  large: config.models.large,
};

export function resolveModel(modelOrTier: string) {
  const tier = modelOrTier as ModelTier;
  const modelId = tiers[tier] ?? modelOrTier;
  return ollama(modelId);
}

export function getTiers() {
  return { ...tiers };
}

export function getModelList() {
  const seen = new Set<string>();
  const models: { id: string; tier?: string }[] = [];

  for (const [tier, modelId] of Object.entries(tiers)) {
    if (!seen.has(modelId)) {
      seen.add(modelId);
      models.push({ id: modelId, tier });
    }
  }

  return models;
}
