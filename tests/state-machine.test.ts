import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../src/errors/app-error.js";
import { NovelStateSchema } from "../src/domain.js";
import { reduceRunState } from "../src/state-machine.js";

function planningState() {
  const now = new Date().toISOString();
  return NovelStateSchema.parse({
    schema: "novel-agent-state/2.0",
    id: "00000000-0000-4000-8000-000000000001",
    status: "planning",
    userRequest: "写一个故事",
    spec: null,
    blueprint: null,
    chapters: [],
    memories: [],
    conversation: [],
    feedback: [],
    currentChapter: 1,
    createdAt: now,
    updatedAt: now,
  });
}

test("state reducer accepts declared transitions and rejects implicit ones", () => {
  const failed = reduceRunState(planningState(), "run_failed");
  assert.equal(failed.status, "failed");
  assert.throws(
    () => reduceRunState(failed, "user_paused"),
    (error: unknown) =>
      error instanceof AppError && error.code === "INVALID_STATE_TRANSITION",
  );
});
