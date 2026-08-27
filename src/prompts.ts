import type {
  ChapterMemory,
  ChapterPlan,
  ChapterReview,
  NovelSpec,
  StoryBlueprint,
} from "./domain.js";
import {
  interpolatePrompt,
  promptCatalog,
  type PromptLocale,
} from "./prompts/catalog.js";

function section(label: string, value: unknown) {
  return `${label}:\n${typeof value === "string" ? value : JSON.stringify(value, null, 2)}`;
}

function memoryContext(memories: ChapterMemory[], locale: PromptLocale) {
  return memories.length === 0
    ? promptCatalog(locale).common.noMemories
    : JSON.stringify(memories, null, 2);
}

function feedbackContext(feedback: string[] | undefined, locale: PromptLocale) {
  return feedback?.length
    ? feedback.join("\n")
    : promptCatalog(locale).common.none;
}

export function analyzeRequestMessages(
  userRequest: string,
  options: { promptLocale: PromptLocale; outputLanguage: string } = {
    promptLocale: "zh-CN",
    outputLanguage: "zh-CN",
  },
) {
  const text = promptCatalog(options.promptLocale);
  return [
    {
      role: "system" as const,
      content: [
        ...text.analyze,
        ...text.common.originality,
        `The required novel output language is ${options.outputLanguage}. Set language to exactly this value.`,
        ...text.common.jsonOnly,
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: `<USER_NOVEL_REQUEST>\n${userRequest}\n</USER_NOVEL_REQUEST>`,
    },
  ];
}

export function blueprintMessages(
  spec: NovelSpec,
  userRequest: string,
  locale: PromptLocale = "zh-CN",
) {
  const text = promptCatalog(locale);
  return [
    {
      role: "system" as const,
      content: [
        ...text.blueprint,
        ...text.common.originality,
        ...text.common.jsonOnly,
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        section(text.labels.originalRequest, userRequest),
        section(text.labels.novelSpec, spec),
      ].join("\n\n"),
    },
  ];
}

export function draftChapterMessages(input: {
  spec: NovelSpec;
  blueprint: StoryBlueprint;
  chapter: ChapterPlan;
  memories: ChapterMemory[];
  feedback?: string[];
  promptLocale?: PromptLocale;
}) {
  const locale = input.promptLocale ?? "zh-CN";
  const text = promptCatalog(locale);
  return [
    {
      role: "system" as const,
      content: [...text.draft, ...text.common.originality].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        interpolatePrompt(text.labels.targetLength, {
          count: input.spec.targetWordsPerChapter,
        }),
        section(text.labels.novelSpec, input.spec),
        section(text.labels.blueprint, input.blueprint),
        section(text.labels.chapterPlan, input.chapter),
        section(text.labels.memories, memoryContext(input.memories, locale)),
        section(text.labels.feedback, feedbackContext(input.feedback, locale)),
      ].join("\n\n"),
    },
  ];
}

export function reviewChapterMessages(input: {
  spec: NovelSpec;
  blueprint: StoryBlueprint;
  chapter: ChapterPlan;
  memories: ChapterMemory[];
  content: string;
  feedback?: string[];
  promptLocale?: PromptLocale;
}) {
  const locale = input.promptLocale ?? "zh-CN";
  const text = promptCatalog(locale);
  return [
    {
      role: "system" as const,
      content: [...text.review, ...text.common.jsonOnly].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        section(text.labels.novelSpec, input.spec),
        section(text.labels.blueprint, input.blueprint),
        section(text.labels.chapterPlan, input.chapter),
        section(
          text.labels.previousMemories,
          memoryContext(input.memories, locale),
        ),
        section(text.labels.content, input.content),
        section(text.labels.feedback, feedbackContext(input.feedback, locale)),
      ].join("\n\n"),
    },
  ];
}

export function reviseChapterMessages(input: {
  spec: NovelSpec;
  blueprint: StoryBlueprint;
  chapter: ChapterPlan;
  memories: ChapterMemory[];
  original: string;
  review: ChapterReview;
  feedback?: string[];
  promptLocale?: PromptLocale;
}) {
  const locale = input.promptLocale ?? "zh-CN";
  const text = promptCatalog(locale);
  return [
    {
      role: "system" as const,
      content: [...text.revise, ...text.common.originality].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        section(text.labels.novelSpec, input.spec),
        section(text.labels.blueprint, input.blueprint),
        section(text.labels.chapterPlan, input.chapter),
        section(
          text.labels.previousMemories,
          memoryContext(input.memories, locale),
        ),
        section(text.labels.review, input.review),
        section(text.labels.original, input.original),
        section(text.labels.feedback, feedbackContext(input.feedback, locale)),
      ].join("\n\n"),
    },
  ];
}

export function memoryMessages(input: {
  blueprint: StoryBlueprint;
  chapter: ChapterPlan;
  previousMemories: ChapterMemory[];
  content: string;
  promptLocale?: PromptLocale;
}) {
  const locale = input.promptLocale ?? "zh-CN";
  const text = promptCatalog(locale);
  return [
    {
      role: "system" as const,
      content: [...text.memory, ...text.common.jsonOnly].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        section(text.labels.blueprint, input.blueprint),
        section(text.labels.chapterPlan, input.chapter),
        section(
          text.labels.previousMemories,
          memoryContext(input.previousMemories, locale),
        ),
        section(text.labels.finalContent, input.content),
      ].join("\n\n"),
    },
  ];
}
