import { mkdir, appendFile, readFile, writeFile } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { NovelStateSchema, type NovelState } from "./domain.js";

function safeName(value: string) {
  const normalized = value
    .trim()
    .replaceAll(/[<>:"/\\|?*\u0000-\u001f]/gu, "-")
    .replaceAll(/\s+/gu, "-")
    .slice(0, 60);
  return normalized || "novel";
}

export type TraceEvent = {
  at: string;
  type: "state" | "model" | "error";
  stage: string;
  data: unknown;
};

export class NovelStore {
  readonly directory: string;
  readonly statePath: string;
  readonly tracePath: string;
  readonly novelPath: string;

  private constructor(directory: string) {
    this.directory = directory;
    this.statePath = resolve(directory, "state.json");
    this.tracePath = resolve(directory, "trace.jsonl");
    this.novelPath = resolve(directory, "novel.md");
  }

  static async create(root: string, state: NovelState) {
    const stamp = new Date().toISOString().replaceAll(/[:.]/gu, "-");
    const title = state.spec?.workingTitle ?? "planning";
    const directory = resolve(root, `${stamp}-${safeName(title)}-${state.id.slice(0, 8)}`);
    await mkdir(directory, { recursive: true });
    const store = new NovelStore(directory);
    await store.saveState(state);
    return store;
  }

  static async open(path: string) {
    const resolvedPath = resolve(path);
    const statePath = basename(resolvedPath).toLowerCase() === "state.json"
      ? resolvedPath
      : resolve(resolvedPath, "state.json");
    const state = NovelStateSchema.parse(JSON.parse(await readFile(statePath, "utf8")));
    return { state, store: new NovelStore(dirname(statePath)) };
  }

  async saveState(state: NovelState) {
    await writeFile(this.statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  }

  async trace(event: Omit<TraceEvent, "at">) {
    const value: TraceEvent = { at: new Date().toISOString(), ...event };
    await appendFile(this.tracePath, `${JSON.stringify(value)}\n`, "utf8");
  }

  async writeNovel(state: NovelState) {
    const chinese = state.spec?.language.toLowerCase().startsWith("zh") ?? true;
    const title = state.blueprint?.title ?? state.spec?.workingTitle ?? (chinese ? "未命名小说" : "Untitled Novel");
    const chapters = state.chapters
      .map((chapter) => `${chinese ? `## 第${chapter.number}章` : `## Chapter ${chapter.number}`} ${chapter.title}\n\n${chapter.content}`)
      .join("\n\n---\n\n");
    await writeFile(this.novelPath, `# ${title}\n\n${chapters}\n`, "utf8");
  }
}
