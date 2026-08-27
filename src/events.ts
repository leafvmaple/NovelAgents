import type { ChapterReview, ModelUsage, UserIntent } from "./domain.js";
import type { CompletionRequest } from "./provider.js";
import type { RunEvent } from "./state-machine.js";

export type ProgressCode =
  | "provider_retry"
  | "json_repair"
  | "analyzing_request"
  | "creating_blueprint"
  | "drafting_chapter"
  | "revising_chapter"
  | "recording_memory";

export type AgentEvent =
  | { type: "progress"; code: ProgressCode; params: Record<string, unknown> }
  | {
      type: "model_completed";
      stage: string;
      provider: string;
      model: string;
      attempt: number;
      durationMs: number;
      usage: ModelUsage;
      request: CompletionRequest;
      response: string;
    }
  | {
      type: "model_failed";
      stage: string;
      attempt: number;
      retrying: boolean;
      durationMs: number;
      error: { message: string; provider?: string; code?: string; status?: number | null };
    }
  | { type: "model_validation_failed"; stage: string; validationErrors: Array<Record<string, unknown>> }
  | { type: "state_changed"; event: RunEvent; from: string; status: string }
  | { type: "analysis_recorded"; provider: string; response: unknown }
  | { type: "chapter_rejected"; chapter: number; review: ChapterReview; revisionCount: number }
  | { type: "user_message_received"; messageId: string }
  | { type: "user_message_routed"; messageId: string; intent: UserIntent }
  | { type: "conversation_response"; intent: UserIntent; response: string };

export type PersistedAgentEvent = AgentEvent & { at: string };
