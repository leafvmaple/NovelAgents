import type { DeepLocaleShape } from "../types.js";

export const enUS = {
  agent: {
    providerRetry: "{purpose} hit a transient provider error; retry {attempt}…",
    repairingJson:
      "{purpose} returned invalid structured data; repairing once…",
    analyzingRequest:
      "The requirements agent is preparing the novel specification…",
    creatingBlueprint:
      "The planning agent is creating the story bible and outline…",
    chapterAlreadySaved:
      "Chapter {chapter} is already saved; continuing with the next chapter.",
    draftingChapter:
      "The writing agent is drafting chapter {chapter}/{total}, “{title}”…",
    revisingChapter:
      "The reviewer requested changes to chapter {chapter}; revision {revision}…",
    recordingMemory: "The continuity agent is recording chapter {chapter}…",
    novelComplete: "The novel is complete with {count} chapters.",
    chapterComplete:
      "Chapter {chapter} is complete. Add an instruction or enter /continue.",
    paused: "Paused; the run state has been saved.",
    statusSummary:
      "Status: {status}; completed {completed}/{total} chapters; next chapter: {next}.",
    feedbackNoFuture:
      "The novel is complete, so there is no future chapter to receive this feedback.",
    globalFeedbackSaved: "Saved as a global instruction for future chapters.",
    nextFeedbackSaved: "Saved and will be applied to the next chapter.",
  },
  review: {
    tooShortProblem:
      "The chapter has {actual} characters, below the minimum complete length of {minimum}.",
    tooShortSuggestion:
      "Rewrite it as a complete scene of at least {minimum} characters; do not return an outline, refusal, or summary.",
    foreignWordsProblem:
      "The Chinese chapter contains untranslated English expressions: {words}.",
    foreignWordsSuggestion:
      "Rewrite unnecessary English in natural Chinese, except proper nouns explicitly requested by the user.",
  },
  cli: {
    specHeading: "Novel specification",
    title: "Title: {value}",
    genre: "Genre: {value}",
    tone: "Tone: {value}",
    pov: "Point of view: {value}",
    chapters: "Chapters: {count}, about {words} words each",
    logline: "Logline: {value}",
    planHeading: "Chapter plan",
    mockNotice:
      "OPENROUTER_API_KEY was not found. Using the offline demo provider.",
    resumedFrom: "Resuming from: {path}",
    completeHeading: "Generation complete",
    chapterCount: "Chapters: {count}",
    novelPath: "Novel: {path}",
    statePath: "State: {path}",
    tracePath: "Trace: {path}",
    requestQuestion:
      "Describe the novel you want (genre, protagonist, conflict, style, chapter count, etc.):\n> ",
    planSaved: "Plan saved: {path}",
    confirm: "Start generation with this plan? [Y/n] ",
    stopped:
      "Stopped. You can inspect the specification and outline in state.json.",
    failed: "Generation failed: {message}",
    chatHelp:
      "Chat mode: /continue generates one chapter, /pause pauses, /status shows progress, /feedback <text> adds a global instruction, /next <text> affects only the next chapter, and /exit exits. Natural language also works.",
    chatPrompt: "\nYou > ",
    chatExit: "Chat closed; run state has been saved.",
    agentReply: "Agent > {message}",
    sessionHeading: "Session ended",
  },
  errors: {
    OPENROUTER_API_KEY_REQUIRED:
      "OPENROUTER_API_KEY is required for OpenRouter.",
    PROVIDER_RETRY_EXHAUSTED: "Provider retries were exhausted.",
    BLUEPRINT_CHAPTER_COUNT_MISMATCH:
      "The blueprint chapter count does not match the specification.",
    BLUEPRINT_POV_CHARACTER_MISSING:
      "A chapter references a missing POV character: {characterId}.",
    NOVEL_PLAN_REQUIRED:
      "A novel specification and blueprint are required before writing.",
    CHAPTER_REVIEW_REJECTED: "Chapter {chapter} did not pass final review.",
    RESUME_PLAN_REQUIRED:
      "The resumed state is missing its specification or blueprint.",
    NOVEL_REQUEST_REQUIRED: "The novel request cannot be empty.",
    INVALID_STATE_TRANSITION:
      "The run cannot perform this transition: {from} → {event}.",
  },
} as const satisfies DeepLocaleShape;
