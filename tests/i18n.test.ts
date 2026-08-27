import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/errors/app-error.js";
import { formatError, translate } from "../src/i18n/index.js";

test("message catalogs interpolate typed keys", () => {
  assert.equal(translate("zh-CN", "agent.recordingMemory", { chapter: 3 }), "连续性 Agent 正在记录第 3 章状态……");
  assert.equal(translate("en-US", "agent.recordingMemory", { chapter: 3 }), "The continuity agent is recording chapter 3…");
});

test("structured errors keep machine codes separate from localized messages", () => {
  const error = new AppError("CHAPTER_REVIEW_REJECTED", { chapter: 2 });
  assert.equal(error.message, "CHAPTER_REVIEW_REJECTED");
  assert.equal(formatError("zh-CN", error), "第 2 章未通过最终审核。");
  assert.equal(formatError("en-US", error), "Chapter 2 did not pass final review.");
});
