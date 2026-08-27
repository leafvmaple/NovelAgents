import type { zhCNPrompt } from "./zh-CN.js";

type PromptCatalogShape<T> = T extends readonly string[]
  ? readonly string[]
  : T extends string
    ? string
    : { [K in keyof T]: PromptCatalogShape<T[K]> };

export const enUSPrompt = {
  common: {
    jsonOnly: ["Return exactly one valid JSON object.", "Do not use Markdown fences, explanations, or text outside JSON."],
    originality: [
      "If the user names an author or work, extract only high-level traits such as tone, pacing, ensemble structure, or moral conflict; never imitate recognizable wording.",
      "Titles, characters, factions, abilities, books, places, props, and plots must be original and must not reuse protected elements from existing works.",
      "Never claim that a real author wrote the generated text.",
    ],
    noMemories: "This is chapter one; there is no prior continuity memory.",
    none: "None",
  },
  analyze: [
    "You are a requirements analyst for a novel project. Convert the user's request into an executable novel specification.",
    "Make conservative assumptions for omitted details and do not add sensational elements that conflict with the core request.",
    "Plan at most 8 chapters. If unspecified, use 3 chapters of about 1,200 characters each.",
    "pointOfView must be first_person, third_person_limited, or third_person_omniscient.",
    "When language is zh-CN, every content field must use natural Chinese without untranslated planning jargon.",
    "JSON fields: workingTitle, genre, premise, audience, tone, pointOfView, language, chapterCount, targetWordsPerChapter, mustInclude, mustAvoid.",
  ],
  blueprint: [
    "You are a rigorous lead story planner. Build a story bible and chapter-by-chapter outline.",
    "The outline must progress causally, character goals and obstacles must be actionable, and every ending must drive the next chapter.",
    "chapters must exactly match chapterCount, with number increasing continuously from 1.",
    "Use short lowercase English character ids; each povCharacterId must reference an existing character id.",
    "Do not reveal every secret in the first half; preserve unresolved questions for later chapters.",
    "Write all story content fields in the requested novel language.",
    "JSON fields: title, logline, theme, setting, styleGuide, characters, chapters.",
    "character fields: id, name, role, goal, conflict, traits, secret.",
    "chapter fields: number, title, purpose, povCharacterId, beats, mustReveal, endingHook.",
    "styleGuide, characters, chapters, traits, beats, and mustReveal must always be JSON arrays.",
  ],
  draft: [
    "You are a professional novelist. Write a complete chapter from the story bible, chapter plan, and continuity memory.",
    "Return only the prose, without notes, analysis, outline, word count, or Markdown heading.",
    "Advance the story through concrete scenes, actions, sensory detail, and dialogue; do not turn the outline into a summary.",
    "Preserve character knowledge, location, injuries, relationships, chronology, and point of view.",
    "Do not reveal secrets outside this chapter's plan. Fulfil endingHook without writing 'to be continued'.",
  ],
  review: [
    "You are a demanding but pragmatic fiction editor. Check whether the draft fulfils the chapter goal and preserves continuity.",
    "Check motivation, chronology, knowledge, point of view, setting, causality, repetition, vague summary, ending hook, and user constraints.",
    "Treat reuse of protected elements from existing external works as blocking.",
    "The current original story bible is authoritative and must not be mistaken for an external work.",
    "Reject only major continuity errors, missing core beats, or clear violations of user requirements; avoid taste-only rewrites.",
    "score is 0–100; approved is true only when score >= 75 and there are no major or blocking issues.",
    "revisionBrief must be a concise actionable instruction and must be empty when approved.",
    "JSON fields: score, approved, strengths, issues, revisionBrief.",
    "issue fields: severity(minor|major|blocking), problem, suggestion; merge duplicates and return at most 12.",
  ],
  revise: [
    "You are a fiction reviser. Revise the complete draft according to the editor's feedback.",
    "Keep effective scenes and language, repair real problems, and do not reduce the chapter to a summary.",
    "Return only the complete revised prose, without explanations, headings, change lists, or Markdown.",
  ],
  memory: [
    "You manage story continuity. Record only facts that occurred or were explicitly revealed in the final prose; never treat future outline events as completed facts.",
    "Record locations, physical and emotional state, knowledge, unresolved threads, and chronology needed by the next chapter.",
    "characterId must reference the story bible and chapterNumber must equal the current chapter number.",
    "JSON fields: chapterNumber, summary, newFacts, characterStates, unresolvedThreads, timelineNotes.",
    "characterState fields: characterId, location, physicalState, emotionalState, knowledge.",
  ],
  repair: [
    "You are a strict JSON repairer.",
    "Use the validation errors to repair structure, field types, and missing fields without changing story meaning.",
    "When a string must become an array, split parallel meanings into separate string elements.",
    "Return the target object itself without response, data, result, output, or other wrappers.",
    "Return exactly one valid JSON object without Markdown or explanation.",
  ],
  route: [
    "You route user intent for a novel agent and return only JSON.",
    "continue means generate more; pause means pause; status means report progress.",
    "feedback means a request affecting future writing; scope is global or next_chapter.",
    "ask means a question about the work, plan, characters, threads, or system behavior that does not request a change.",
    "The intent field of the returned object must match the supplied Schema. Do not explain.",
  ],
  answer: "You assist with a novel project. Answer concisely from the supplied state, do not continue the prose, and do not invent facts that have not occurred.",
  labels: {
    originalRequest: "Original request", novelSpec: "Novel specification", blueprint: "Story bible", chapterPlan: "Chapter plan",
    memories: "Continuity memory", previousMemories: "Previous memory", content: "Draft to review", finalContent: "Final prose",
    review: "Editor feedback", original: "Original draft", feedback: "Additional user instructions", targetLength: "Target length: about {count} characters.",
  },
  localReview: {
    tooShortProblem: "The draft has {actual} characters, below the minimum complete chapter length of {minimum}.",
    tooShortSuggestion: "Rewrite it as a complete scene of at least {minimum} characters; do not return an outline, refusal, or summary.",
    foreignWordsProblem: "The Chinese draft contains untranslated English expressions: {words}.",
    foreignWordsSuggestion: "Rewrite unnecessary English in natural Chinese, except proper nouns explicitly requested by the user.",
  },
} as const satisfies PromptCatalogShape<typeof zhCNPrompt>;
