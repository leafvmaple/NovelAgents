import type { ChatMessage } from "../domain.js";
import { promptCatalog, type PromptLocale } from "./catalog.js";

export function repairJsonMessages(input: {
  originalTaskMessages: ChatMessage[];
  validationErrors: unknown;
  originalJson: string;
}, locale: PromptLocale = "zh-CN"): ChatMessage[] {
  const text = promptCatalog(locale);
  return [
    {
      role: "system",
      content: text.repair.join("\n"),
    },
    { role: "user", content: JSON.stringify(input) },
  ];
}
