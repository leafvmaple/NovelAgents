import assert from "node:assert/strict";
import test from "node:test";
import { analyzeRequestMessages } from "../src/prompts.js";
import { repairJsonMessages } from "../src/prompts/repair-json.js";

test("request prompt keeps prompt locale and output language independent", () => {
  const messages = analyzeRequestMessages("write a mystery", {
    promptLocale: "en-US",
    outputLanguage: "ja-JP",
  });
  assert.match(messages[0]?.content ?? "", /requirements analyst/u);
  assert.match(
    messages[0]?.content ?? "",
    /required novel output language is ja-JP/u,
  );
  assert.doesNotMatch(messages[0]?.content ?? "", /你是小说项目/u);
});

test("JSON repair prompt is built outside agent workflow code", () => {
  const messages = repairJsonMessages({
    originalTaskMessages: [],
    validationErrors: [],
    originalJson: "{}",
  });
  assert.equal(messages[0]?.role, "system");
  assert.match(messages[0]?.content ?? "", /JSON 数据修复器/u);
});
