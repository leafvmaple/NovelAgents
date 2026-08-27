import { AppError } from "./errors/app-error.js";
import { NovelStateSchema, type NovelState } from "./domain.js";

export type RunEvent =
  | "plan_ready"
  | "start_writing"
  | "resume_writing"
  | "chapter_paused"
  | "run_completed"
  | "user_paused"
  | "run_failed";

const transitions: Record<RunEvent, Partial<Record<NovelState["status"], NovelState["status"]>>> = {
  plan_ready: { planning: "awaiting_confirmation" },
  start_writing: { awaiting_confirmation: "writing", paused: "writing", writing: "writing" },
  resume_writing: { failed: "writing" },
  chapter_paused: { writing: "paused" },
  run_completed: { writing: "complete", paused: "complete" },
  user_paused: { awaiting_confirmation: "paused", paused: "paused" },
  run_failed: { planning: "failed", awaiting_confirmation: "failed", writing: "failed", paused: "failed" },
};

export function reduceRunState(
  state: NovelState,
  event: RunEvent,
  patch: Partial<Omit<NovelState, "schema" | "id" | "status" | "createdAt">> = {},
) {
  const status = transitions[event][state.status];
  if (!status) {
    throw new AppError("INVALID_STATE_TRANSITION", { from: state.status, event });
  }
  return NovelStateSchema.parse({
    ...state,
    ...patch,
    status,
    updatedAt: new Date().toISOString(),
  });
}
