import assert from "node:assert/strict";
import test from "node:test";
import { NovelStateSchema, StoryBlueprintSchema } from "../src/domain.js";

const character = {
  id: "hero",
  name: "主角",
  role: "主角",
  goal: "找出真相",
  conflict: "线索相互矛盾",
  traits: ["谨慎"],
  secret: null,
};

function chapter(number: number) {
  return {
    number,
    title: `第${number}章`,
    purpose: "推进调查",
    povCharacterId: "hero",
    beats: ["发现线索", "遭遇阻力"],
    mustReveal: [],
    endingHook: "出现新问题",
  };
}

test("blueprint rejects duplicate, discontinuous, and missing POV references", () => {
  const base = {
    title: "测试小说",
    logline: "主角调查一宗谜案。",
    theme: "选择",
    setting: "港城",
    styleGuide: ["第三人称", "语言克制"],
    characters: [character],
  };
  assert.equal(
    StoryBlueprintSchema.safeParse({
      ...base,
      chapters: [chapter(1), chapter(1)],
    }).success,
    false,
  );
  assert.equal(
    StoryBlueprintSchema.safeParse({ ...base, chapters: [chapter(2)] }).success,
    false,
  );
  assert.equal(
    StoryBlueprintSchema.safeParse({
      ...base,
      chapters: [{ ...chapter(1), povCharacterId: "missing" }],
    }).success,
    false,
  );
});

test("state rejects completion and current chapter values inconsistent with the blueprint", () => {
  const now = new Date().toISOString();
  const blueprint = StoryBlueprintSchema.parse({
    title: "测试小说",
    logline: "主角调查一宗谜案。",
    theme: "选择",
    setting: "港城",
    styleGuide: ["第三人称", "语言克制"],
    characters: [character],
    chapters: [chapter(1)],
  });
  const state = {
    schema: "novel-agent-state/2.0",
    id: "00000000-0000-4000-8000-000000000001",
    status: "complete",
    userRequest: "写一个故事",
    spec: null,
    blueprint,
    chapters: [],
    memories: [],
    conversation: [],
    feedback: [],
    currentChapter: 99,
    createdAt: now,
    updatedAt: now,
  };
  const result = NovelStateSchema.safeParse(state);
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.error.issues.length >= 2);
});
