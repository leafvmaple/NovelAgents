import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  ChapterMemorySchema,
  ChapterReviewSchema,
  NovelSpecSchema,
  NovelStateSchema,
  StoryBlueprintSchema,
  type ChatMessage,
  type ChapterReview,
  type NovelSpec,
  type NovelState,
} from "./domain.js";
import { parseModelJson } from "./json.js";
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

export type AgentObserver = (message: string) => void;

type NovelAgentOptions = {
  outputRoot: string;
  maxRevisions: number;
  maxProviderRetries: number;
};

function isRetryableProviderError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /OPENROUTER_RESPONSE_EMPTY|OPENROUTER_REQUEST_FAILED:(408|429|500|502|503|504):|CODEX_REQUEST_TIMEOUT|CODEX_REQUEST_FAILED:.*(?:429|5\d\d|temporar|overload|CODEX_RESPONSE_EMPTY)|fetch failed|aborted/iu.test(
    message,
  );
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
      : (review.revisionBrief || review.issues.map((issue) => issue.suggestion).join("；")).slice(0, 1000),
  });
}

function localChapterReview(content: string, spec: NovelSpec): ChapterReview | null {
  const issues: ChapterReview["issues"] = [];
  const minimumLength = Math.max(250, Math.floor(spec.targetWordsPerChapter * 0.5));
  if (content.trim().length < minimumLength) {
    issues.push({
      severity: "blocking",
      problem: `正文只有 ${content.trim().length} 个字符，低于最低完整章节长度 ${minimumLength}。`,
      suggestion: `重写为至少 ${minimumLength} 个字符的完整场景正文，不能输出提纲、拒绝说明或摘要。`,
    });
  }
  const englishTokens = content.match(/\b[A-Za-z]{3,}\b/gu) ?? [];
  if (spec.language.toLowerCase().startsWith("zh") && englishTokens.length >= 3) {
    issues.push({
      severity: "major",
      problem: `中文正文混入了未本地化的英文表达：${englishTokens.slice(0, 6).join(", ")}。`,
      suggestion: "将非必要英文表达改写为自然中文；用户明确要求保留的专有名词除外。",
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

  private async call(
    store: NovelStore | null,
    purpose: string,
    messages: ChatMessage[],
    options: { json: boolean; temperature: number; maxTokens: number; outputSchema?: unknown },
  ) {
    const request: CompletionRequest = { purpose, messages, ...options };
    for (let attempt = 0; attempt <= this.options.maxProviderRetries; attempt += 1) {
      const started = Date.now();
      try {
        const result = await this.provider.complete(request);
        await store?.trace({
          type: "model",
          stage: purpose,
          data: {
            provider: this.provider.name,
            model: result.model,
            attempt,
            durationMs: Date.now() - started,
            usage: result.usage,
            request,
            response: result.content,
          },
        });
        return result.content;
      } catch (error) {
        const retrying = attempt < this.options.maxProviderRetries && isRetryableProviderError(error);
        await store?.trace({
          type: "error",
          stage: purpose,
          data: {
            attempt,
            retrying,
            durationMs: Date.now() - started,
            message: error instanceof Error ? error.message : String(error),
          },
        });
        if (!retrying) throw error;
        this.observe(`${purpose} 遇到 Provider 瞬时失败，正在进行第 ${attempt + 1} 次重试……`);
      }
    }
    throw new Error("PROVIDER_RETRY_EXHAUSTED");
  }

  private async callJson<S extends z.ZodTypeAny>(
    store: NovelStore | null,
    purpose: string,
    messages: ChatMessage[],
    schema: S,
    options: { temperature: number; maxTokens: number },
  ): Promise<z.output<S>> {
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
          : [{ path: "response", expected: "valid JSON", message: String(error) }];
      this.observe(`${purpose} 的结构化结果不符合契约，正在自动修复一次……`);
      await store?.trace({
        type: "error",
        stage: `${purpose}-validation`,
        data: { validationErrors },
      });
      const repaired = await this.call(
        store,
        `${purpose}-repair`,
        [
          {
            role: "system",
            content: [
              "你是严格的 JSON 数据修复器。",
              "根据校验错误修正给定 JSON，只修复结构、字段类型和缺失字段，不改变故事含义。",
              "字符串需要变为数组时，将其中并列的语义拆成多个字符串元素。",
              "输出必须是原任务要求的目标对象本身，禁止添加 response、data、result、output 等包装字段。",
              "只输出一个合法 JSON 对象，不要 Markdown，不要解释。",
            ].join("\n"),
          },
          {
            role: "user",
            content: JSON.stringify({
              originalTaskMessages: messages,
              validationErrors,
              originalJson: content,
            }),
          },
        ],
        { json: true, temperature: 0, maxTokens: options.maxTokens, outputSchema },
      );
      return parseModelJson(schema, repaired);
    }
  }

  private async transition(store: NovelStore, state: NovelState, status: NovelState["status"]) {
    const next = NovelStateSchema.parse({
      ...state,
      status,
      updatedAt: new Date().toISOString(),
    });
    await store.saveState(next);
    await store.trace({ type: "state", stage: status, data: { status } });
    return next;
  }

  async prepare(userRequest: string) {
    const now = new Date().toISOString();
    let state = NovelStateSchema.parse({
      schema: "novel-agent-state/1.0",
      id: randomUUID(),
      status: "planning",
      userRequest,
      spec: null,
      blueprint: null,
      chapters: [],
      memories: [],
      createdAt: now,
      updatedAt: now,
    });

    this.observe("需求分析 Agent 正在整理小说规格……");
    const spec = await this.callJson(
      null,
      "analyze-request",
      analyzeRequestMessages(userRequest),
      NovelSpecSchema,
      { temperature: 0.25, maxTokens: 1600 },
    );
    state = NovelStateSchema.parse({ ...state, spec, updatedAt: new Date().toISOString() });
    const store = await NovelStore.create(this.options.outputRoot, state);
    await store.trace({
      type: "model",
      stage: "analyze-request",
      data: { provider: this.provider.name, recoveredBeforeStoreCreation: true, response: spec },
    });

    this.observe("策划 Agent 正在建立故事圣经和逐章大纲……");
    const blueprint = await this.callJson(
      store,
      "create-blueprint",
      blueprintMessages(spec, userRequest),
      StoryBlueprintSchema,
      { temperature: 0.55, maxTokens: 4000 },
    );
    if (blueprint.chapters.length !== spec.chapterCount) {
      throw new Error("BLUEPRINT_CHAPTER_COUNT_MISMATCH");
    }
    const characterIds = new Set(blueprint.characters.map((character) => character.id));
    for (const chapter of blueprint.chapters) {
      if (!characterIds.has(chapter.povCharacterId)) {
        throw new Error(`BLUEPRINT_POV_CHARACTER_MISSING:${chapter.povCharacterId}`);
      }
    }
    state = NovelStateSchema.parse({
      ...state,
      blueprint,
      status: "awaiting_confirmation",
      updatedAt: new Date().toISOString(),
    });
    await store.saveState(state);
    await store.trace({ type: "state", stage: "awaiting_confirmation", data: { status: state.status } });
    return { state, store };
  }

  async execute(initialState: NovelState, store: NovelStore) {
    if (!initialState.spec || !initialState.blueprint) {
      throw new Error("NOVEL_PLAN_REQUIRED");
    }
    const spec = initialState.spec;
    const blueprint = initialState.blueprint;
    let state = await this.transition(store, initialState, "writing");

    try {
      for (const chapterPlan of blueprint.chapters) {
        if (state.chapters.some((chapter) => chapter.number === chapterPlan.number)) {
          this.observe(`第 ${chapterPlan.number} 章已有持久化结果，从下一章继续。`);
          continue;
        }
        this.observe(`写作 Agent 正在创作第 ${chapterPlan.number}/${blueprint.chapters.length} 章《${chapterPlan.title}》……`);
        let content = await this.call(
          store,
          `draft-chapter-${chapterPlan.number}`,
          draftChapterMessages({ spec, blueprint, chapter: chapterPlan, memories: state.memories }),
          { json: false, temperature: 0.82, maxTokens: Math.min(8000, spec.targetWordsPerChapter * 2) },
        );
        let revisionCount = 0;
        let review = localChapterReview(content, spec);
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
              }),
              ChapterReviewSchema,
              { temperature: 0.15, maxTokens: 3000 },
            ),
          );
        }

        while (!review.approved && revisionCount < this.options.maxRevisions) {
          revisionCount += 1;
          this.observe(`审稿 Agent 要求修改第 ${chapterPlan.number} 章，执行第 ${revisionCount} 次改稿……`);
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
            }),
            { json: false, temperature: 0.65, maxTokens: Math.min(8000, spec.targetWordsPerChapter * 2) },
          );
          review = localChapterReview(content, spec);
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
                }),
                ChapterReviewSchema,
                { temperature: 0.1, maxTokens: 3000 },
              ),
            );
          }
        }

        if (!review.approved) {
          await store.trace({
            type: "error",
            stage: `chapter-${chapterPlan.number}-rejected`,
            data: { review, revisionCount },
          });
          throw new Error(`CHAPTER_REVIEW_REJECTED:${chapterPlan.number}`);
        }

        this.observe(`连续性 Agent 正在记录第 ${chapterPlan.number} 章状态……`);
        const memory = await this.callJson(
          store,
          `memory-chapter-${chapterPlan.number}`,
          memoryMessages({
            blueprint,
            chapter: chapterPlan,
            previousMemories: state.memories,
            content,
          }),
          ChapterMemorySchema,
          { temperature: 0.1, maxTokens: 2000 },
        );
        state = NovelStateSchema.parse({
          ...state,
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
          updatedAt: new Date().toISOString(),
        });
        await store.saveState(state);
        await store.writeNovel(state);
      }

      state = await this.transition(store, state, "complete");
      await store.writeNovel(state);
      return state;
    } catch (error) {
      await this.transition(store, state, "failed");
      throw error;
    }
  }
}
