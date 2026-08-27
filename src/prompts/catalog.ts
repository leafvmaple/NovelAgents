import { enUSPrompt } from "./locales/en-US.js";
import { zhCNPrompt } from "./locales/zh-CN.js";

export const promptLocales = ["zh-CN", "en-US"] as const;
export type PromptLocale = (typeof promptLocales)[number];

export function promptCatalog(locale: PromptLocale) {
  return locale === "en-US" ? enUSPrompt : zhCNPrompt;
}

export function interpolatePrompt(
  template: string,
  params: Record<string, string | number | boolean | null | undefined>,
) {
  return template.replace(/\{(\w+)\}/gu, (_, key: string) => {
    const value = params[key];
    return value === null || value === undefined ? `{${key}}` : String(value);
  });
}
