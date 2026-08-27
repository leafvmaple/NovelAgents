import "dotenv/config";
import { resolve } from "node:path";
import { z } from "zod";
import { CodexProvider } from "./codex-provider.js";
import { AppError } from "./errors/app-error.js";
import { locales } from "./i18n/index.js";
import { MockProvider, OpenRouterProvider, type ModelProvider } from "./provider.js";

const ConfigSchema = z
  .object({
    provider: z.enum(["auto", "openrouter", "codex", "mock"]),
    apiKey: z.string(),
    model: z.string().trim().min(1),
    codexModel: z.string().trim().min(1),
    baseUrl: z.string().url(),
    timeoutMs: z.number().int().min(5_000).max(600_000),
    maxRevisions: z.number().int().min(0).max(3),
    maxProviderRetries: z.number().int().min(0).max(3),
    outputRoot: z.string().trim().min(1),
    uiLocale: z.enum(locales),
    promptLocale: z.enum(locales),
    outputLanguage: z.string().trim().min(1),
  })
  .strict();

export function loadConfig(forceMock = false) {
  return ConfigSchema.parse({
    provider: forceMock ? "mock" : (process.env.NOVEL_AGENT_PROVIDER ?? "auto"),
    apiKey: process.env.OPENROUTER_API_KEY ?? "",
    model: process.env.NOVEL_AGENT_MODEL ?? "openrouter/free",
    codexModel: process.env.NOVEL_AGENT_CODEX_MODEL ?? "gpt-5.6-terra",
    baseUrl: process.env.NOVEL_AGENT_BASE_URL ?? "https://openrouter.ai/api/v1",
    timeoutMs: Number(process.env.NOVEL_AGENT_TIMEOUT_MS ?? 120_000),
    maxRevisions: Number(process.env.NOVEL_AGENT_MAX_REVISIONS ?? 1),
    maxProviderRetries: Number(process.env.NOVEL_AGENT_MAX_PROVIDER_RETRIES ?? 1),
    outputRoot: resolve(process.cwd(), process.env.NOVEL_AGENT_OUTPUT_DIR ?? "outputs"),
    uiLocale: process.env.NOVEL_AGENT_UI_LOCALE ?? "zh-CN",
    promptLocale: process.env.NOVEL_AGENT_PROMPT_LOCALE ?? "zh-CN",
    outputLanguage: process.env.NOVEL_AGENT_OUTPUT_LANGUAGE ?? "zh-CN",
  });
}

export function createProvider(config: ReturnType<typeof loadConfig>): ModelProvider {
  if (config.provider === "codex") {
    return new CodexProvider({
      model: config.codexModel,
      timeoutMs: config.timeoutMs,
      workingDirectory: process.cwd(),
    });
  }
  if (config.provider === "mock" || (config.provider === "auto" && !config.apiKey)) {
    return new MockProvider();
  }
  if (!config.apiKey) throw new AppError("OPENROUTER_API_KEY_REQUIRED");
  return new OpenRouterProvider({
    apiKey: config.apiKey,
    baseUrl: config.baseUrl,
    model: config.model,
    timeoutMs: config.timeoutMs,
  });
}
