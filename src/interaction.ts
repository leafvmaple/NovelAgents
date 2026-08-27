import type { UserIntent } from "./domain.js";

export function parseUserCommand(input: string): UserIntent | null {
  const value = input.trim();
  if (/^\/(?:continue|继续)$/iu.test(value)) return { type: "continue" };
  if (/^\/(?:pause|暂停)$/iu.test(value)) return { type: "pause" };
  if (/^\/(?:status|状态|进度)$/iu.test(value)) return { type: "status" };
  const feedback = value.match(/^\/(?:feedback|要求)\s+([\s\S]+)$/iu);
  if (feedback?.[1])
    return {
      type: "feedback",
      scope: "global",
      instruction: feedback[1].trim(),
    };
  const next = value.match(/^\/(?:next|下一章)\s+([\s\S]+)$/iu);
  if (next?.[1])
    return {
      type: "feedback",
      scope: "next_chapter",
      instruction: next[1].trim(),
    };
  return null;
}
