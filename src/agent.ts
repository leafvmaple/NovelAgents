import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ChapterMemorySchema,
  ChapterReviewSchema,
  NovelSpecSchema,
  NovelStateSchema,
  StoryBlueprintSchema,
  UserIntentResultSchema,
  type ChatMessage,
  type ChapterReview,
  type NovelSpec,
  type NovelState,
  type UserIntent,
} from "./domain.js";
import { parseModelJson } from "./json.js";
import { AppError } from "./errors/app-error.js";
import { ProviderError } from "./errors/provider-error.js";
import { translate, type UiLocale } from "./i18n/index.js";
import { createOpenAiOutputSchema } from "./json-schema.js";
import type { CompletionRequest, ModelProvider } from "./provider.js";
import {
  analyzeRequestMessages,
  blueprintMessages,
  draftChapterMessages,
  memoryMessages,
  reviewChapterMessages,
  reviseChapterMessages,
} from "./prompts.js";
import { NovelStore } from "./storage.js";
import { repairJsonMessages } from "./prompts/repair-json.js";
import {
  answerUserQuestionMessages,
  routeUserMessageMessages,
} from "./prompts/route-user-message.js";
import { parseUserCommand } from "./interaction.js";
import { reduceRunState, type RunEvent } from "./state-machine.js";
import type { AgentEvent } from "./events.js";
import {
  interpolatePrompt,
  promptCatalog,
  type PromptLocale,
} from "./prompts/catalog.js";

export type AgentObserver = (event: AgentEvent) => void;

type NovelAgentOptions = {
  outputRoot: string;
  maxRevisions: number;
  maxProviderRetries: number;
  uiLocale: UiLocale;
  promptLocale: PromptLocale;
  outputLanguage: string;
};

function isRetryableProviderError(error: unknown) {
  return error instanceof ProviderError && error.retryable;
}

export function normalizeReview(review: ChapterReview) {
  const hasRejectingIssue = review.issues.some(
    (issue) => issue.severity === "major" || issue.severity === "blocking",
  );
  const approved = review.approved && review.score >= 75 && !hasRejectingIssue;
  return ChapterReviewSchema.parse({
    ...review,
    approved,
    revisionBrief: approved
      ? ""
      : (
          review.revisionBrief ||
          review.issues.map((issue) => issue.suggestion).join("; ")
        ).slice(0, 1000),
  });
}

function localChapterReview(
  content: string,
  spec: NovelSpec,
  locale: PromptLocale,
): ChapterReview | null {
  const messages = promptCatalog(locale).localReview;
  const issues: ChapterReview["issues"] = [];
  const minimumLength = Math.max(
    250,
    Math.floor(spec.targetWordsPerChapter * 0.5),
  );
  if (content.trim().length < minimumLength) {
    issues.push({
      severity: "blocking",
      problem: interpolatePrompt(messages.tooShortProblem, {
        actual: content.trim().length,
        minimum: minimumLength,
      }),
      suggestion: interpolatePrompt(messages.tooShortSuggestion, {
        minimum: minimumLength,
      }),
    });
  }
  const englishTokens = content.match(/\b[A-Za-z]{3,}\b/gu) ?? [];
  if (
    spec.language.toLowerCase().startsWith("zh") &&
    englishTokens.length >= 3
  ) {
    issues.push({
      severity: "major",
      problem: interpolatePrompt(messages.foreignWordsProblem, {
        words: englishTokens.slice(0, 6).join(", "),
      }),
      suggestion: messages.foreignWordsSuggestion,
    });
  }
  if (issues.length === 0) return null;
  return ChapterReviewSchema.parse({
    score: 30,
    approved: false,
    strengths: [],
    issues,
    revisionBrief: issues.map((issue) => issue.suggestion).join("；"),
  });
}

export class NovelAgent {
  constructor(
    private readonly provider: ModelProvider,
    private readonly options: NovelAgentOptions,
    private readonly observe: AgentObserver = () => undefined,
  ) {}

  private async emit(store: NovelStore | null, event: AgentEvent) {
    await store?.trace(event);
    this.observe(event);
  }

  private async call(
    store: NovelStore | null,
    purpose: string,
    messages: ChatMessage[],
    options: {
      json: boolean;
      temperature: number;
      maxTokens: number;
      outputSchema?: unknown;
    },
  ) {
    const request: CompletionRequest = { purpose, messages, ...options };
    for (
      let attempt = 0;
      attempt <= this.options.maxProviderRetries;
      attempt += 1
    ) {
      const started = Date.now();
      try {
        const result = await this.provider.complete(request);
        await this.emit(store, {
          type: "model_completed",
          stage: purpose,
          provider: this.provider.name,
          model: result.model,
          attempt,
          durationMs: Date.now() - started,
          usage: result.usage,
          request,
          response: result.content,
        });
        return result.content;
      } catch (error) {
        const retrying =
          attempt < this.options.maxProviderRetries &&
          isRetryableProviderError(error);
        await this.emit(store, {
          type: "model_failed",
          stage: purpose,
          attempt,
          retrying,
          durationMs: Date.now() - started,
          error: {
            message: error instanceof Error ? error.message : String(error),
            ...(error instanceof ProviderError
              ? {
                  provider: error.provider,
                  code: error.code,
                  status: error.status,
                }
              : {}),
          },
        });
        if (!retrying) throw error;
        await this.emit(store, {
          type: "progress",
          code: "provider_retry",
          params: { purpose, attempt: attempt + 1 },
        });
      }
    }
    throw new AppError("PROVIDER_RETRY_EXHAUSTED");
  }

  private async callJson<Output, Input>(
    store: NovelStore | null,
    purpose: string,
    messages: ChatMessage[],
    schema: z.ZodType<Output, z.ZodTypeDef, Input>,
    options: { temperature: number; maxTokens: number },
  ): Promise<Output> {
    const outputSchema = createOpenAiOutputSchema(schema);
    const content = await this.call(store, purpose, messages, {
      ...options,
      json: true,
      outputSchema,
    });
    try {
      return parseModelJson(schema, content);
    } catch (error) {
      const validationErrors =
        error instanceof z.ZodError
          ? error.issues.map((issue) => ({
              path: issue.path.join("."),
              expected: issue.code,
              message: issue.message,
            }))
          : [
              {
                path: "response",
                expected: "valid JSON",
                message: String(error),
              },
            ];
      await this.emit(store, {
        type: "progress",
        code: "json_repair",
        params: { purpose },
      });
      await this.emit(store, {
        type: "model_validation_failed",
        stage: `${purpose}-validation`,
        validationErrors,
      });
      const repaired = await this.call(
        store,
        `${purpose}-repair`,
        repairJsonMessages(
          {
            originalTaskMessages: messages,
            validationErrors,
            originalJson: content,
          },
          this.options.promptLocale,
        ),
        {
          json: true,
          temperature: 0,
          maxTokens: options.maxTokens,
          outputSchema,
        },
      );
      return parseModelJson(schema, repaired);
    }
  }

  private async transition(
    store: NovelStore,
    state: NovelState,
    event: RunEvent,
    patch: Partial<
      Omit<NovelState, "schema" | "id" | "status" | "createdAt">
    > = {},
  ) {
    const next = reduceRunState(state, event, patch);
    await store.saveState(next);
    await this.emit(store, {
      type: "state_changed",
      event,
      from: state.status,
      status: next.status,
    });
    return next;
  }

  async prepare(userRequest: string) {
    const now = new Date().toISOString();
    let state = NovelStateSchema.parse({
      schema: "novel-agent-state/2.0",
      id: randomUUID(),
      status: "planning",
      userRequest,
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

    await this.emit(null, {
      type: "progress",
      code: "analyzing_request",
      params: {},
    });
    const analyzedSpec = await this.callJson(
      null,
      "analyze-request",
      analyzeRequestMessages(userRequest, {
        promptLocale: this.options.promptLocale,
        outputLanguage: this.options.outputLanguage,
      }),
      NovelSpecSchema,
      { temperature: 0.25, maxTokens: 1600 },
    );
    const spec = NovelSpecSchema.parse({
      ...analyzedSpec,
      language: this.options.outputLanguage,
    });
    state = NovelStateSchema.parse({
      ...state,
      spec,
      updatedAt: new Date().toISOString(),
    });
    const store = await NovelStore.create(this.options.outputRoot, state);
    await this.emit(store, {
      type: "analysis_recorded",
      provider: this.provider.name,
      response: spec,
    });

    await this.emit(store, {
      type: "progress",
      code: "creating_blueprint",
      params: {},
    });
    const blueprint = await this.callJson(
      store,
      "create-blueprint",
      blueprintMessages(spec, userRequest, this.options.promptLocale),
      StoryBlueprintSchema,
      { temperature: 0.55, maxTokens: 4000 },
    );
    if (blueprint.chapters.length !== spec.chapterCount) {
      throw new AppError("BLUEPRINT_CHAPTER_COUNT_MISMATCH");
    }
    const characterIds = new Set(
      blueprint.characters.map((character) => character.id),
    );
    for (const chapter of blueprint.chapters) {
      if (!characterIds.has(chapter.povCharacterId)) {
        throw new AppError("BLUEPRINT_POV_CHARACTER_MISSING", {
          characterId: chapter.povCharacterId,
        });
      }
    }
    state = await this.transition(store, state, "plan_ready", { blueprint });
    return { state, store };
  }

  private async runNextChapterUnlocked(
    initialState: NovelState,
    store: NovelStore,
  ) {
    if (!initialState.spec || !initialState.blueprint)
      throw new AppError("NOVEL_PLAN_REQUIRED");
    if (initialState.status === "complete") return initialState;
    const spec = initialState.spec;
    const blueprint = initialState.blueprint;
    const chapterPlan = blueprint.chapters.find(
      (candidate) =>
        !initialState.chapters.some(
          (chapter) => chapter.number === candidate.number,
        ),
    );
    if (!chapterPlan)
      return this.transition(store, initialState, "run_completed");
    const startEvent =
      initialState.status === "failed" ? "resume_writing" : "start_writing";
    let state = await this.transition(store, initialState, startEvent);

    try {
      const activeFeedback = state.feedback.filter(
        (item) =>
          item.scope === "global" ||
          (item.scope === "next_chapter" && item.status === "pending"),
      );
      await this.emit(store, {
        type: "progress",
        code: "drafting_chapter",
        params: {
          chapter: chapterPlan.number,
          total: blueprint.chapters.length,
          title: chapterPlan.title,
        },
      });
      let content = await this.call(
        store,
        `draft-chapter-${chapterPlan.number}`,
        draftChapterMessages({
          spec,
          blueprint,
          chapter: chapterPlan,
          memories: state.memories,
          feedback: activeFeedback.map((item) => item.instruction),
          promptLocale: this.options.promptLocale,
        }),
        {
          json: false,
          temperature: 0.82,
          maxTokens: Math.min(8000, spec.targetWordsPerChapter * 2),
        },
      );
      let revisionCount = 0;
      let review = localChapterReview(content, spec, this.options.promptLocale);
      if (!review) {
        review = normalizeReview(
          await this.callJson(
            store,
            `review-chapter-${chapterPlan.number}`,
            reviewChapterMessages({
              spec,
              blueprint,
              chapter: chapterPlan,
              memories: state.memories,
              content,
              feedback: activeFeedback.map((item) => item.instruction),
              promptLocale: this.options.promptLocale,
            }),
            ChapterReviewSchema,
            { temperature: 0.15, maxTokens: 3000 },
          ),
        );
      }
      while (!review.approved && revisionCount < this.options.maxRevisions) {
        revisionCount += 1;
        await this.emit(store, {
          type: "progress",
          code: "revising_chapter",
          params: {
            chapter: chapterPlan.number,
            revision: revisionCount,
          },
        });
        content = await this.call(
          store,
          `revise-chapter-${chapterPlan.number}`,
          reviseChapterMessages({
            spec,
            blueprint,
            chapter: chapterPlan,
            memories: state.memories,
            original: content,
            review,
            feedback: activeFeedback.map((item) => item.instruction),
            promptLocale: this.options.promptLocale,
          }),
          {
            json: false,
            temperature: 0.65,
            maxTokens: Math.min(8000, spec.targetWordsPerChapter * 2),
          },
        );
        review = localChapterReview(content, spec, this.options.promptLocale);
        if (!review) {
          review = normalizeReview(
            await this.callJson(
              store,
              `review-chapter-${chapterPlan.number}-revision-${revisionCount}`,
              reviewChapterMessages({
                spec,
                blueprint,
                chapter: chapterPlan,
                memories: state.memories,
                content,
                feedback: activeFeedback.map((item) => item.instruction),
                promptLocale: this.options.promptLocale,
              }),
              ChapterReviewSchema,
              { temperature: 0.1, maxTokens: 3000 },
            ),
          );
        }
      }
      if (!review.approved) {
        await this.emit(store, {
          type: "chapter_rejected",
          chapter: chapterPlan.number,
          review,
          revisionCount,
        });
        throw new AppError("CHAPTER_REVIEW_REJECTED", {
          chapter: chapterPlan.number,
        });
      }
      await this.emit(store, {
        type: "progress",
        code: "recording_memory",
        params: { chapter: chapterPlan.number },
      });
      const memory = await this.callJson(
        store,
        `memory-chapter-${chapterPlan.number}`,
        memoryMessages({
          blueprint,
          chapter: chapterPlan,
          previousMemories: state.memories,
          content,
          promptLocale: this.options.promptLocale,
        }),
        ChapterMemorySchema,
        { temperature: 0.1, maxTokens: 2000 },
      );
      const complete = state.chapters.length + 1 >= blueprint.chapters.length;
      state = await this.transition(
        store,
        state,
        complete ? "run_completed" : "chapter_paused",
        {
          chapters: [
            ...state.chapters,
            {
              number: chapterPlan.number,
              title: chapterPlan.title,
              content,
              revisionCount,
              review,
            },
          ],
          memories: [...state.memories, memory],
          feedback: state.feedback.map((item) =>
            item.scope === "next_chapter" && item.status === "pending"
              ? {
                  ...item,
                  status: "applied" as const,
                  appliedToChapter: chapterPlan.number,
                }
              : item,
          ),
          currentChapter: chapterPlan.number + 1,
        },
      );
      await store.writeNovel(state);
      return state;
    } catch (error) {
      if (state.status !== "complete")
        await this.transition(store, state, "run_failed");
      throw error;
    }
  }

  async runNextChapter(initialState: NovelState, store: NovelStore) {
    return store.withLock(async () => {
      const latest = await store.loadState();
      if (latest.id !== initialState.id)
        throw new Error("RUN_STATE_ID_MISMATCH");
      return this.runNextChapterUnlocked(latest, store);
    });
  }

  async execute(initialState: NovelState, store: NovelStore) {
    let state = initialState;
    while (state.status !== "complete")
      state = await this.runNextChapter(state, store);
    return state;
  }

  private async handleUserMessageUnlocked(
    initialState: NovelState,
    store: NovelStore,
    message: string,
  ) {
    const now = new Date().toISOString();
    const userMessageId = randomUUID();
    let state = NovelStateSchema.parse({
      ...initialState,
      conversation: [
        ...initialState.conversation,
        {
          id: userMessageId,
          role: "user",
          content: message,
          intent: null,
          createdAt: now,
        },
      ],
      updatedAt: now,
    });
    await store.saveState(state);
    await this.emit(store, {
      type: "user_message_received",
      messageId: userMessageId,
    });

    const explicit = parseUserCommand(message);
    const intent: UserIntent =
      explicit ??
      (
        await this.callJson(
          store,
          "route-user-message",
          routeUserMessageMessages(state, message, this.options.promptLocale),
          UserIntentResultSchema,
          { temperature: 0, maxTokens: 500 },
        )
      ).intent;
    state = NovelStateSchema.parse({
      ...state,
      conversation: state.conversation.map((item) =>
        item.id === userMessageId ? { ...item, intent } : item,
      ),
      updatedAt: new Date().toISOString(),
    });
    await store.saveState(state);
    await this.emit(store, {
      type: "user_message_routed",
      messageId: userMessageId,
      intent,
    });
    let response: string;
    if (intent.type === "continue") {
      state = await this.runNextChapterUnlocked(state, store);
      response =
        state.status === "complete"
          ? translate(this.options.uiLocale, "agent.novelComplete", {
              count: state.chapters.length,
            })
          : translate(this.options.uiLocale, "agent.chapterComplete", {
              chapter: state.chapters.at(-1)?.number,
            });
    } else if (intent.type === "pause") {
      state = await this.transition(store, state, "user_paused");
      response = translate(this.options.uiLocale, "agent.paused");
    } else if (intent.type === "status") {
      response = translate(this.options.uiLocale, "agent.statusSummary", {
        status: state.status,
        completed: state.chapters.length,
        total: state.blueprint?.chapters.length ?? 0,
        next: state.currentChapter,
      });
    } else if (intent.type === "feedback") {
      if (state.status === "complete") {
        response = translate(this.options.uiLocale, "agent.feedbackNoFuture");
      } else {
        state = NovelStateSchema.parse({
          ...state,
          feedback: [
            ...state.feedback,
            {
              id: randomUUID(),
              scope: intent.scope,
              instruction: intent.instruction,
              status: "pending",
              createdAt: now,
              appliedToChapter: null,
            },
          ],
          updatedAt: now,
        });
        response = translate(
          this.options.uiLocale,
          intent.scope === "global"
            ? "agent.globalFeedbackSaved"
            : "agent.nextFeedbackSaved",
        );
      }
    } else {
      response = await this.call(
        store,
        "answer-user-question",
        answerUserQuestionMessages(
          state,
          intent.question,
          this.options.promptLocale,
        ),
        { json: false, temperature: 0.2, maxTokens: 1200 },
      );
    }
    state = NovelStateSchema.parse({
      ...state,
      conversation: [
        ...state.conversation,
        {
          id: randomUUID(),
          role: "assistant",
          content: response,
          intent: null,
          createdAt: new Date().toISOString(),
        },
      ],
      updatedAt: new Date().toISOString(),
    });
    await store.saveState(state);
    await this.emit(store, { type: "conversation_response", intent, response });
    return { state, response, intent };
  }

  async handleUserMessage(
    initialState: NovelState,
    store: NovelStore,
    message: string,
  ) {
    return store.withLock(async () => {
      const latest = await store.loadState();
      if (latest.id !== initialState.id)
        throw new Error("RUN_STATE_ID_MISMATCH");
      return this.handleUserMessageUnlocked(latest, store, message);
    });
  }
}
