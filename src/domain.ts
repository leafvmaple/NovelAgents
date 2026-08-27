import { z } from "zod";

export const NovelSpecSchema = z
  .object({
    workingTitle: z.string().trim().min(1).max(80),
    genre: z.string().trim().min(1).max(80),
    premise: z.string().trim().min(1).max(800),
    audience: z.string().trim().min(1).max(80),
    tone: z.string().trim().min(1).max(120),
    pointOfView: z.enum([
      "first_person",
      "third_person_limited",
      "third_person_omniscient",
    ]),
    language: z.string().trim().min(1).max(40).default("zh-CN"),
    chapterCount: z.number().int().min(1).max(8),
    targetWordsPerChapter: z.number().int().min(500).max(4000),
    mustInclude: z.array(z.string().trim().min(1).max(200)).max(12).default([]),
    mustAvoid: z.array(z.string().trim().min(1).max(200)).max(12).default([]),
  })
  .strict();

export const CharacterSchema = z
  .object({
    id: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_-]{0,31}$/),
    name: z.string().trim().min(1).max(40),
    role: z.string().trim().min(1).max(80),
    goal: z.string().trim().min(1).max(240),
    conflict: z.string().trim().min(1).max(240),
    traits: z.array(z.string().trim().min(1).max(60)).min(1).max(6),
    secret: z.string().trim().max(240).nullable(),
  })
  .strict();

export const ChapterPlanSchema = z
  .object({
    number: z.number().int().positive(),
    title: z.string().trim().min(1).max(80),
    purpose: z.string().trim().min(1).max(300),
    povCharacterId: z.string().trim().min(1).max(32),
    beats: z.array(z.string().trim().min(1).max(240)).min(2).max(8),
    mustReveal: z.array(z.string().trim().min(1).max(200)).max(5),
    endingHook: z.string().trim().min(1).max(240),
  })
  .strict();

export const StoryBlueprintSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    logline: z.string().trim().min(1).max(300),
    theme: z.string().trim().min(1).max(200),
    setting: z.string().trim().min(1).max(800),
    styleGuide: z.array(z.string().trim().min(1).max(200)).min(2).max(10),
    characters: z.array(CharacterSchema).min(1).max(10),
    chapters: z.array(ChapterPlanSchema).min(1).max(8),
  })
  .strict()
  .superRefine((blueprint, context) => {
    const characterIds = new Set(
      blueprint.characters.map((character) => character.id),
    );
    blueprint.chapters.forEach((chapter, index) => {
      const expectedNumber = index + 1;
      if (chapter.number !== expectedNumber) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["chapters", index, "number"],
          message: `章节编号必须从 1 连续递增；此处应为 ${expectedNumber}。`,
        });
      }
      if (!characterIds.has(chapter.povCharacterId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["chapters", index, "povCharacterId"],
          message: "章节视角角色必须引用 characters 中存在的 id。",
        });
      }
    });
  });

export const ReviewIssueSchema = z
  .object({
    severity: z.enum(["minor", "major", "blocking"]),
    problem: z.string().trim().min(1).max(300),
    suggestion: z.string().trim().min(1).max(300),
  })
  .strict();

export const ChapterReviewSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    approved: z.boolean(),
    strengths: z.array(z.string().trim().min(1).max(200)).max(6),
    issues: z.array(ReviewIssueSchema).max(12),
    revisionBrief: z.string().trim().max(1000),
  })
  .strict();

export const CharacterStateSchema = z
  .object({
    characterId: z.string().trim().min(1).max(32),
    location: z.string().trim().min(1).max(120),
    physicalState: z.string().trim().min(1).max(200),
    emotionalState: z.string().trim().min(1).max(200),
    knowledge: z.array(z.string().trim().min(1).max(200)).max(12),
  })
  .strict();

export const ChapterMemorySchema = z
  .object({
    chapterNumber: z.number().int().positive(),
    summary: z.string().trim().min(1).max(1200),
    newFacts: z.array(z.string().trim().min(1).max(240)).max(15),
    characterStates: z.array(CharacterStateSchema).max(10),
    unresolvedThreads: z.array(z.string().trim().min(1).max(240)).max(15),
    timelineNotes: z.array(z.string().trim().min(1).max(240)).max(12),
  })
  .strict();

export const GeneratedChapterSchema = z
  .object({
    number: z.number().int().positive(),
    title: z.string().trim().min(1).max(80),
    content: z.string().trim().min(1),
    revisionCount: z.number().int().nonnegative(),
    review: ChapterReviewSchema,
  })
  .strict();

export const UserIntentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("continue") }).strict(),
  z.object({ type: z.literal("pause") }).strict(),
  z.object({ type: z.literal("status") }).strict(),
  z
    .object({
      type: z.literal("ask"),
      question: z.string().trim().min(1).max(2000),
    })
    .strict(),
  z
    .object({
      type: z.literal("feedback"),
      scope: z.enum(["global", "next_chapter"]),
      instruction: z.string().trim().min(1).max(2000),
    })
    .strict(),
]);

export const UserIntentResultSchema = z
  .object({ intent: UserIntentSchema })
  .strict();

export const ConversationMessageSchema = z
  .object({
    id: z.string().uuid(),
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(8000),
    intent: UserIntentSchema.nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const UserFeedbackSchema = z
  .object({
    id: z.string().uuid(),
    scope: z.enum(["global", "next_chapter"]),
    instruction: z.string().trim().min(1).max(2000),
    status: z.enum(["pending", "applied"]),
    createdAt: z.string().datetime(),
    appliedToChapter: z.number().int().positive().nullable(),
  })
  .strict();

export const NovelStateV1Schema = z
  .object({
    schema: z.literal("novel-agent-state/1.0"),
    id: z.string().uuid(),
    status: z.enum([
      "planning",
      "awaiting_confirmation",
      "writing",
      "complete",
      "failed",
    ]),
    userRequest: z.string().trim().min(1).max(8000),
    spec: NovelSpecSchema.nullable(),
    blueprint: StoryBlueprintSchema.nullable(),
    chapters: z.array(GeneratedChapterSchema),
    memories: z.array(ChapterMemorySchema),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const NovelStateSchema = z
  .object({
    schema: z.literal("novel-agent-state/2.0"),
    id: z.string().uuid(),
    status: z.enum([
      "planning",
      "awaiting_confirmation",
      "writing",
      "paused",
      "complete",
      "failed",
    ]),
    userRequest: z.string().trim().min(1).max(8000),
    spec: NovelSpecSchema.nullable(),
    blueprint: StoryBlueprintSchema.nullable(),
    chapters: z.array(GeneratedChapterSchema),
    memories: z.array(ChapterMemorySchema),
    conversation: z.array(ConversationMessageSchema),
    feedback: z.array(UserFeedbackSchema),
    currentChapter: z.number().int().positive(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((state, context) => {
    const chapterNumbers = state.chapters.map((chapter) => chapter.number);
    const memoryNumbers = state.memories.map((memory) => memory.chapterNumber);
    const uniqueChapterNumbers = new Set(chapterNumbers);
    const uniqueMemoryNumbers = new Set(memoryNumbers);
    if (uniqueChapterNumbers.size !== chapterNumbers.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chapters"],
        message: "已生成章节编号不能重复。",
      });
    }
    if (uniqueMemoryNumbers.size !== memoryNumbers.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["memories"],
        message: "章节记忆编号不能重复。",
      });
    }
    const orderedChapters = [...chapterNumbers].sort((a, b) => a - b);
    const orderedMemories = [...memoryNumbers].sort((a, b) => a - b);
    if (JSON.stringify(orderedChapters) !== JSON.stringify(orderedMemories)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["memories"],
        message: "每个已生成章节必须有且只有一条对应的连续性记忆。",
      });
    }

    if (!state.blueprint) {
      if (state.currentChapter !== 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["currentChapter"],
          message: "没有大纲时当前章节必须为 1。",
        });
      }
      if (state.status === "complete") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["status"],
          message: "没有大纲的运行不能标记为完成。",
        });
      }
      return;
    }

    const plannedNumbers = new Set(
      state.blueprint.chapters.map((chapter) => chapter.number),
    );
    if (chapterNumbers.some((number) => !plannedNumbers.has(number))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chapters"],
        message: "已生成章节必须存在于故事大纲中。",
      });
    }
    const firstMissing = state.blueprint.chapters.find(
      (chapter) => !uniqueChapterNumbers.has(chapter.number),
    );
    const expectedCurrentChapter =
      firstMissing?.number ?? state.blueprint.chapters.length + 1;
    if (state.currentChapter !== expectedCurrentChapter) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["currentChapter"],
        message: `当前章节应为 ${expectedCurrentChapter}。`,
      });
    }
    const allComplete = !firstMissing;
    if ((state.status === "complete") !== allComplete) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: allComplete
          ? "全部计划章节完成后状态必须为 complete。"
          : "仍有计划章节未完成，状态不能为 complete。",
      });
    }
  });

export function migrateNovelState(input: unknown) {
  const current = NovelStateSchema.safeParse(input);
  if (current.success) return current.data;
  const legacy = NovelStateV1Schema.parse(input);
  return NovelStateSchema.parse({
    ...legacy,
    schema: "novel-agent-state/2.0",
    conversation: [],
    feedback: [],
    currentChapter: legacy.chapters.length + 1,
  });
}

export type NovelSpec = z.infer<typeof NovelSpecSchema>;
export type StoryBlueprint = z.infer<typeof StoryBlueprintSchema>;
export type ChapterPlan = z.infer<typeof ChapterPlanSchema>;
export type ChapterReview = z.infer<typeof ChapterReviewSchema>;
export type ChapterMemory = z.infer<typeof ChapterMemorySchema>;
export type NovelState = z.infer<typeof NovelStateSchema>;
export type UserIntent = z.infer<typeof UserIntentSchema>;
export type UserFeedback = z.infer<typeof UserFeedbackSchema>;

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ModelUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export type ModelResult = {
  content: string;
  model: string;
  usage: ModelUsage;
};
