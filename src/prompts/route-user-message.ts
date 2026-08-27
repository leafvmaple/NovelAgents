import type { NovelState } from "../domain.js";

export function routeUserMessageMessages(state: NovelState, message: string) {
  return [
    {
      role: "system" as const,
      content: [
        "你是小说 Agent 的用户意图路由器，只返回 JSON。",
        "continue：用户要求继续生成；pause：暂停；status：询问进度。",
        "feedback：用户提出会影响后续创作的要求；scope 使用 global 或 next_chapter。",
        "ask：用户只是询问作品、计划、角色、伏笔或系统行为，不要求修改。",
        "JSON 必须直接符合给定 Schema，不要解释。",
      ].join("\n"),
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

export function answerUserQuestionMessages(state: NovelState, question: string) {
  return [
    {
      role: "system" as const,
      content: "你是小说项目助手。只根据给定状态简洁回答，不续写正文，不虚构尚未发生的事实。",
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
