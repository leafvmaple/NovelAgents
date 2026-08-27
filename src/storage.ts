import { randomUUID } from "node:crypto";
import {
  mkdir,
  appendFile,
  open,
  readFile,
  rename,
  unlink,
} from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { migrateNovelState, type NovelState } from "./domain.js";
import type { AgentEvent, PersistedAgentEvent } from "./events.js";

const runLockTails = new Map<string, Promise<void>>();

async function atomicWrite(path: string, content: string) {
  const temporaryPath = resolve(
    dirname(path),
    `.${basename(path)}.${process.pid}.${randomUUID()}.tmp`,
  );
  const handle = await open(temporaryPath, "wx");
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
    await handle.close();
    await rename(temporaryPath, path);
  } catch (error) {
    await handle.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

function safeName(value: string) {
  const normalized = value
    .trim()
    .replaceAll(/[<>:"/\\|?*\u0000-\u001f]/gu, "-")
    .replaceAll(/\s+/gu, "-")
    .slice(0, 60);
  return normalized || "novel";
}

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
    const directory = resolve(
      root,
      `${stamp}-${safeName(title)}-${state.id.slice(0, 8)}`,
    );
    await mkdir(directory, { recursive: true });
    const store = new NovelStore(directory);
    await store.saveState(state);
    return store;
  }

  static async open(path: string) {
    const resolvedPath = resolve(path);
    const statePath =
      basename(resolvedPath).toLowerCase() === "state.json"
        ? resolvedPath
        : resolve(resolvedPath, "state.json");
    const raw = JSON.parse(await readFile(statePath, "utf8")) as {
      schema?: unknown;
    };
    const state = migrateNovelState(raw);
    const store = new NovelStore(dirname(statePath));
    if (raw.schema !== state.schema) await store.saveState(state);
    return { state, store };
  }

  async saveState(state: NovelState) {
    await atomicWrite(this.statePath, `${JSON.stringify(state, null, 2)}\n`);
  }

  async loadState() {
    return migrateNovelState(
      JSON.parse(await readFile(this.statePath, "utf8")),
    );
  }

  async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const key = this.directory.toLowerCase();
    const previous = runLockTails.get(key) ?? Promise.resolve();
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolveGate) => {
      release = resolveGate;
    });
    const tail = previous.then(() => gate);
    runLockTails.set(key, tail);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (runLockTails.get(key) === tail) runLockTails.delete(key);
    }
  }

  async trace(event: AgentEvent) {
    const value: PersistedAgentEvent = {
      at: new Date().toISOString(),
      ...event,
    };
    await appendFile(this.tracePath, `${JSON.stringify(value)}\n`, "utf8");
  }

  async writeNovel(state: NovelState) {
    const chinese = state.spec?.language.toLowerCase().startsWith("zh") ?? true;
    const title =
      state.blueprint?.title ??
      state.spec?.workingTitle ??
      (chinese ? "未命名小说" : "Untitled Novel");
    const chapters = state.chapters
      .map(
        (chapter) =>
          `${chinese ? `## 第${chapter.number}章` : `## Chapter ${chapter.number}`} ${chapter.title}\n\n${chapter.content}`,
      )
      .join("\n\n---\n\n");
    await atomicWrite(this.novelPath, `# ${title}\n\n${chapters}\n`);
  }
}
