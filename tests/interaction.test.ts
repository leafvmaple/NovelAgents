import assert from "node:assert/strict";
import test from "node:test";
import { migrateNovelState } from "../src/domain.js";
import { parseUserCommand } from "../src/interaction.js";

const legacyState = {
  schema: "novel-agent-state/1.0",
  id: "00000000-0000-4000-8000-000000000001",
  status: "awaiting_confirmation",
  userRequest: "写一个故事",
  spec: null,
  blueprint: null,
  chapters: [],
  memories: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

test("migrates persisted v1 runs to conversational v2 state", () => {
  const state = migrateNovelState(legacyState);
  assert.equal(state.schema, "novel-agent-state/2.0");
  assert.equal(state.currentChapter, 1);
  assert.deepEqual(state.conversation, []);
  assert.deepEqual(state.feedback, []);
});

test("parses deterministic chat commands without a model call", () => {
  assert.deepEqual(parseUserCommand("/continue"), { type: "continue" });
  assert.deepEqual(parseUserCommand("/下一章 放慢节奏"), {
    type: "feedback",
    scope: "next_chapter",
    instruction: "放慢节奏",
  });
  assert.deepEqual(parseUserCommand("/feedback 不要使用巧合"), {
    type: "feedback",
    scope: "global",
    instruction: "不要使用巧合",
  });
  assert.equal(parseUserCommand("主角现在知道什么？"), null);
});
