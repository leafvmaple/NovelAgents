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
    id: z.string().trim().regex(/^[a-z][a-z0-9_-]{0,31}$/),
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
  .strict();

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

export const NovelStateSchema = z
  .object({
    schema: z.literal("novel-agent-state/1.0"),
    id: z.string().uuid(),
    status: z.enum(["planning", "awaiting_confirmation", "writing", "complete", "failed"]),
    userRequest: z.string().trim().min(1).max(8000),
    spec: NovelSpecSchema.nullable(),
    blueprint: StoryBlueprintSchema.nullable(),
    chapters: z.array(GeneratedChapterSchema),
    memories: z.array(ChapterMemorySchema),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type NovelSpec = z.infer<typeof NovelSpecSchema>;
export type StoryBlueprint = z.infer<typeof StoryBlueprintSchema>;
export type ChapterPlan = z.infer<typeof ChapterPlanSchema>;
export type ChapterReview = z.infer<typeof ChapterReviewSchema>;
export type ChapterMemory = z.infer<typeof ChapterMemorySchema>;
export type NovelState = z.infer<typeof NovelStateSchema>;

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
