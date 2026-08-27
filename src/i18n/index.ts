import { AppError } from "../errors/app-error.js";
import { enUS } from "./locales/en-US.js";
import { zhCN } from "./locales/zh-CN.js";
import type { AgentEvent, ProgressCode } from "../events.js";

export const locales = ["zh-CN", "en-US"] as const;
export type UiLocale = (typeof locales)[number];
export type MessageKey = { [S in keyof typeof zhCN]: `${S & string}.${keyof (typeof zhCN)[S] & string}` }[keyof typeof zhCN];
const catalogs = { "zh-CN": zhCN, "en-US": enUS };

export function translate(locale: UiLocale, key: MessageKey, params: Record<string, unknown> = {}) {
  const [section, name] = key.split(".") as [keyof typeof zhCN, string];
  const catalog = catalogs[locale] as Record<string, Record<string, string>>;
  const template = catalog[section]?.[name] ?? key;
  return template.replace(/\{(\w+)\}/gu, (_, param: string) => String(params[param] ?? `{${param}}`));
}

export function formatError(locale: UiLocale, error: unknown) {
  if (error instanceof AppError) return translate(locale, `errors.${error.code}`, error.params);
  return error instanceof Error ? error.message : String(error);
}

const progressMessageKeys: Record<ProgressCode, MessageKey> = {
  provider_retry: "agent.providerRetry",
  json_repair: "agent.repairingJson",
  analyzing_request: "agent.analyzingRequest",
  creating_blueprint: "agent.creatingBlueprint",
  drafting_chapter: "agent.draftingChapter",
  revising_chapter: "agent.revisingChapter",
  recording_memory: "agent.recordingMemory",
};

export function formatAgentEvent(locale: UiLocale, event: AgentEvent) {
  return event.type === "progress" ? translate(locale, progressMessageKeys[event.code], event.params) : null;
}
