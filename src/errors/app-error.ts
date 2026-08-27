export const errorCodes = [
  "OPENROUTER_API_KEY_REQUIRED",
  "PROVIDER_RETRY_EXHAUSTED",
  "BLUEPRINT_CHAPTER_COUNT_MISMATCH",
  "BLUEPRINT_POV_CHARACTER_MISSING",
  "NOVEL_PLAN_REQUIRED",
  "CHAPTER_REVIEW_REJECTED",
  "RESUME_PLAN_REQUIRED",
  "NOVEL_REQUEST_REQUIRED",
  "INVALID_STATE_TRANSITION",
] as const;

export type ErrorCode = (typeof errorCodes)[number];
export type ErrorParams = Record<string, string | number>;

export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly params: ErrorParams = {},
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "AppError";
  }
}
