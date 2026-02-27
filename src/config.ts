import "dotenv/config";

export const config = {
  port: Number(process.env.PORT) || 4000,
  host: process.env.HOST || "0.0.0.0",
  nodeEnv: process.env.NODE_ENV || "development",

  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434/v1",
  },

  models: {
    small: process.env.MODEL_SMALL || "qwen2.5:7b",
    medium: process.env.MODEL_MEDIUM || "qwen2.5:32b",
    large: process.env.MODEL_LARGE || "qwen2.5:72b",
  },

  auth: {
    apiKey: process.env.API_KEY || "",
    localBypass: process.env.LOCAL_BYPASS !== "false",
  },
};

export type Config = typeof config;
export type ModelTier = keyof typeof config.models;
