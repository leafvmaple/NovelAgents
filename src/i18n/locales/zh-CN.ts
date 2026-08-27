export const zhCN = {
  agent: {
    providerRetry:
      "{purpose} 遇到 Provider 瞬时失败，正在进行第 {attempt} 次重试……",
    repairingJson: "{purpose} 的结构化结果不符合契约，正在自动修复一次……",
    analyzingRequest: "需求分析 Agent 正在整理小说规格……",
    creatingBlueprint: "策划 Agent 正在建立故事圣经和逐章大纲……",
    chapterAlreadySaved: "第 {chapter} 章已有持久化结果，从下一章继续。",
    draftingChapter: "写作 Agent 正在创作第 {chapter}/{total} 章《{title}》……",
    revisingChapter:
      "审稿 Agent 要求修改第 {chapter} 章，执行第 {revision} 次改稿……",
    recordingMemory: "连续性 Agent 正在记录第 {chapter} 章状态……",
    novelComplete: "小说已完成，共 {count} 章。",
    chapterComplete:
      "第 {chapter} 章已完成。你可以追加要求，或输入 /continue。",
    paused: "已暂停，状态已经保存。",
    statusSummary:
      "状态：{status}；已完成 {completed}/{total} 章；下一章：{next}。",
    feedbackNoFuture: "小说已经完成，没有可应用该反馈的后续章节。",
    globalFeedbackSaved: "已记录为后续章节的全局要求。",
    nextFeedbackSaved: "已记录，将应用到下一章。",
  },
  review: {
    tooShortProblem:
      "正文只有 {actual} 个字符，低于最低完整章节长度 {minimum}。",
    tooShortSuggestion:
      "重写为至少 {minimum} 个字符的完整场景正文，不能输出提纲、拒绝说明或摘要。",
    foreignWordsProblem: "中文正文混入了未本地化的英文表达：{words}。",
    foreignWordsSuggestion:
      "将非必要英文表达改写为自然中文；用户明确要求保留的专有名词除外。",
  },
  cli: {
    specHeading: "小说规格",
    title: "书名：{value}",
    genre: "类型：{value}",
    tone: "基调：{value}",
    pov: "视角：{value}",
    chapters: "章节：{count} 章，每章约 {words} 字",
    logline: "一句话：{value}",
    planHeading: "章节计划",
    mockNotice:
      "未检测到 OPENROUTER_API_KEY，当前使用离线演示 Provider。复制 .env.example 为 .env 并填写 Key 可调用真实免费模型。",
    resumedFrom: "从状态继续：{path}",
    completeHeading: "生成完成",
    chapterCount: "章节数：{count}",
    novelPath: "小说：{path}",
    statePath: "状态：{path}",
    tracePath: "调用轨迹：{path}",
    requestQuestion:
      "请描述你想写的小说（题材、主角、冲突、风格、章节数等，可以只写一句话）：\n> ",
    planSaved: "规划状态已保存：{path}",
    confirm: "是否按此计划开始生成？[Y/n] ",
    stopped: "已停止。你可以查看 state.json 中的规格和大纲。",
    failed: "生成失败：{message}",
    chatHelp:
      "对话模式：/continue 生成下一章，/pause 暂停，/status 查看进度，/feedback <要求> 添加全局要求，/next <要求> 只影响下一章，/exit 退出。也可以直接使用自然语言。",
    chatPrompt: "\n你 > ",
    chatExit: "已退出对话，运行状态已保存。",
    agentReply: "Agent > {message}",
    sessionHeading: "会话已结束",
  },
  errors: {
    OPENROUTER_API_KEY_REQUIRED:
      "使用 OpenRouter 时必须配置 OPENROUTER_API_KEY。",
    PROVIDER_RETRY_EXHAUSTED: "模型服务重试次数已耗尽。",
    BLUEPRINT_CHAPTER_COUNT_MISMATCH: "故事大纲的章节数与小说规格不一致。",
    BLUEPRINT_POV_CHARACTER_MISSING:
      "章节引用了不存在的视角角色：{characterId}。",
    NOVEL_PLAN_REQUIRED: "开始写作前必须先生成小说规格和大纲。",
    CHAPTER_REVIEW_REJECTED: "第 {chapter} 章未通过最终审核。",
    RESUME_PLAN_REQUIRED: "恢复的状态中缺少小说规格或大纲。",
    NOVEL_REQUEST_REQUIRED: "小说需求不能为空。",
    INVALID_STATE_TRANSITION: "运行状态不允许执行该操作：{from} → {event}。",
  },
} as const;
