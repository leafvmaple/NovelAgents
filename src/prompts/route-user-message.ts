import type { NovelState } from "../domain.js";
import { promptCatalog, type PromptLocale } from "./catalog.js";

export function routeUserMessageMessages(state: NovelState, message: string, locale: PromptLocale = "zh-CN") {
  const text = promptCatalog(locale);
  return [
    {
      role: "system" as const,
      content: text.route.join("\n"),
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        message,
        runStatus: state.status,
        currentChapter: state.currentChapter,
        completedChapters: state.chapters.map((chapter) => chapter.number),
      }),
    },
  ];
}

export function answerUserQuestionMessages(state: NovelState, question: string, locale: PromptLocale = "zh-CN") {
  const text = promptCatalog(locale);
  return [
    {
      role: "system" as const,
      content: text.answer,
    },
    {
      role: "user" as const,
      content: JSON.stringify({
        question,
        spec: state.spec,
        blueprint: state.blueprint,
        chapters: state.chapters.map(({ number, title, content, review }) => ({ number, title, content, review })),
        memories: state.memories,
        feedback: state.feedback,
      }),
    },
  ];
}
