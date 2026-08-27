import type {
  ChapterMemory,
  ChapterPlan,
  ChapterReview,
  NovelSpec,
  StoryBlueprint,
} from "./domain.js";

const jsonOnly = [
  "只返回一个合法 JSON 对象。",
  "不要使用 Markdown 代码块，不要添加解释，不要添加 JSON 之外的文字。",
].join("\n");

const originalityRules = [
  "如果用户提到具体作家或作品，只能提取古雅/明快、叙事节奏、人物群像、道德冲突等高层特征，不得仿写可识别的原文表达。",
  "标题、人物、门派、武功、秘籍、地名、道具和情节必须原创，不得复用或近似改写现有作品的专有元素。",
  "不得把真实作家写成作者或在正文中声称作品出自该作家。",
].join("\n");

export function analyzeRequestMessages(
  userRequest: string,
  options: { promptLocale: "zh-CN" | "en-US"; outputLanguage: string } = {
    promptLocale: "zh-CN",
    outputLanguage: "zh-CN",
  },
) {
  return [
    {
      role: "system" as const,
      content: [
        "你是小说项目的需求分析师。把用户的自然语言愿望整理为可执行的小说规格。",
        "用户没有明确说明的部分可以做保守推断；不要擅自加入与核心要求冲突的猎奇设定。",
        originalityRules,
        "第一版最多规划 8 章。用户未指定时使用 3 章，每章约 1200 个中文字符。",
        "pointOfView 只能是 first_person、third_person_limited 或 third_person_omniscient。",
        "language 为 zh-CN 时，所有内容字段必须使用自然中文，不得混入未翻译的英文策划术语。",
        `Prompt 指令语言：${options.promptLocale}；小说输出语言必须设置为：${options.outputLanguage}。`,
        jsonOnly,
        "JSON 字段：workingTitle, genre, premise, audience, tone, pointOfView, language, chapterCount, targetWordsPerChapter, mustInclude, mustAvoid。",
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: `<USER_NOVEL_REQUEST>\n${userRequest}\n</USER_NOVEL_REQUEST>`,
    },
  ];
}

export function blueprintMessages(spec: NovelSpec, userRequest: string) {
  return [
    {
      role: "system" as const,
      content: [
        "你是严谨的小说总策划，负责建立故事圣经和逐章大纲。",
        "大纲必须能形成因果推进，角色目标和阻力必须可执行，每章结尾必须推动下一章。",
        "chapters 数量必须与 chapterCount 完全一致，number 从 1 连续递增。",
        "每个角色 id 使用短小写英文标识；每章 povCharacterId 必须引用 characters 中存在的 id。",
        "不要在前半段提前泄露所有秘密，必须为后续章节保留未解决问题。",
        "小说语言为 zh-CN 时，所有标题、描述、情节点和风格指南必须使用自然中文。",
        originalityRules,
        jsonOnly,
        "JSON 字段：title, logline, theme, setting, styleGuide, characters, chapters。",
        "character 字段：id, name, role, goal, conflict, traits, secret。",
        "chapter 字段：number, title, purpose, povCharacterId, beats, mustReveal, endingHook。",
        "styleGuide、characters、chapters、traits、beats、mustReveal 必须是 JSON 数组，即使只有一个元素也不能输出字符串。",
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        `原始需求：\n${userRequest}`,
        `小说规格：\n${JSON.stringify(spec, null, 2)}`,
      ].join("\n\n"),
    },
  ];
}

function memoryContext(memories: ChapterMemory[]) {
  if (memories.length === 0) return "这是第一章，尚无前情。";
  return JSON.stringify(memories, null, 2);
}

export function draftChapterMessages(input: {
  spec: NovelSpec;
  blueprint: StoryBlueprint;
  chapter: ChapterPlan;
  memories: ChapterMemory[];
}) {
  return [
    {
      role: "system" as const,
      content: [
        "你是职业小说作者。根据故事圣经、章节计划和连续性记忆写出完整章节正文。",
        "只输出小说正文，不要输出写作说明、分析、大纲、字数统计或 Markdown 标题。",
        "使用具体场景、动作、感官和对话推进故事；避免把大纲直接改写成摘要。",
        "严格保持人物已知信息、位置、伤势、关系、时间线和叙事视角一致。",
        "不得提前泄露本章计划之外的秘密。章节结尾落实 endingHook，但不要写‘未完待续’。",
        originalityRules,
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        `目标长度：约 ${input.spec.targetWordsPerChapter} 个中文字符。`,
        `小说规格：\n${JSON.stringify(input.spec, null, 2)}`,
        `故事圣经：\n${JSON.stringify(input.blueprint, null, 2)}`,
        `本章计划：\n${JSON.stringify(input.chapter, null, 2)}`,
        `连续性记忆：\n${memoryContext(input.memories)}`,
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
}) {
  return [
    {
      role: "system" as const,
      content: [
        "你是苛刻但务实的小说责任编辑。检查正文是否完成章节目标以及是否存在连续性错误。",
        "重点检查：人物动机、时间线、已知信息、视角、设定、因果、重复、空泛叙述、结尾钩子和用户禁区。",
        "若正文复用现有作品的标题、人物、门派、武功、秘籍、地名、道具或标志性情节，必须判为 blocking。",
        "这里的‘现有作品’只指本次任务之外已经存在的作品；正文遵循当前原创故事圣经中的人物和设定是必须的，绝不能因此判定复用。",
        "只有存在重大连续性错误、遗漏核心情节点、明显违背用户要求时才拒绝。不要因个人审美做无意义重写。",
        "score 为 0 到 100；approved 只有在 score >= 75 且不存在 major 或 blocking 问题时为 true。",
        "revisionBrief 必须是可以直接交给改稿作者的短指令；通过时使用空字符串。",
        jsonOnly,
        "JSON 字段：score, approved, strengths, issues, revisionBrief。",
        "issue 字段：severity(minor|major|blocking), problem, suggestion；合并重复问题，总数最多 12 条。",
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        `小说规格：\n${JSON.stringify(input.spec, null, 2)}`,
        `故事圣经：\n${JSON.stringify(input.blueprint, null, 2)}`,
        `本章计划：\n${JSON.stringify(input.chapter, null, 2)}`,
        `此前记忆：\n${memoryContext(input.memories)}`,
        `待审正文：\n${input.content}`,
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
}) {
  return [
    {
      role: "system" as const,
      content: [
        "你是小说改稿作者。根据责任编辑意见修订全文。",
        "保留原稿中已经有效的场景和语言，只修复真实问题；不要把正文缩成概要。",
        "只输出修订后的完整小说正文，不输出解释、标题、修改清单或 Markdown。",
        originalityRules,
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        `小说规格：\n${JSON.stringify(input.spec, null, 2)}`,
        `故事圣经：\n${JSON.stringify(input.blueprint, null, 2)}`,
        `本章计划：\n${JSON.stringify(input.chapter, null, 2)}`,
        `此前记忆：\n${memoryContext(input.memories)}`,
        `责任编辑意见：\n${JSON.stringify(input.review, null, 2)}`,
        `原稿：\n${input.original}`,
      ].join("\n\n"),
    },
  ];
}

export function memoryMessages(input: {
  blueprint: StoryBlueprint;
  chapter: ChapterPlan;
  previousMemories: ChapterMemory[];
  content: string;
}) {
  return [
    {
      role: "system" as const,
      content: [
        "你是小说连续性管理员。只记录正文中已经实际发生或明确揭示的事实，不得把未来大纲当成已发生事实。",
        "记录下一章真正需要知道的角色位置、身体状态、情绪、知识、未解决线索和时间线。",
        "characterId 必须引用故事圣经中的角色 id。chapterNumber 必须等于当前章节号。",
        jsonOnly,
        "JSON 字段：chapterNumber, summary, newFacts, characterStates, unresolvedThreads, timelineNotes。",
        "characterState 字段：characterId, location, physicalState, emotionalState, knowledge。",
      ].join("\n"),
    },
    {
      role: "user" as const,
      content: [
        `故事圣经：\n${JSON.stringify(input.blueprint, null, 2)}`,
        `当前章节计划：\n${JSON.stringify(input.chapter, null, 2)}`,
        `此前记忆：\n${memoryContext(input.previousMemories)}`,
        `已定稿正文：\n${input.content}`,
      ].join("\n\n"),
    },
  ];
}
