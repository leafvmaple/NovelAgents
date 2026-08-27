import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { NovelAgent } from "../src/agent.js";
import { MockProvider } from "../src/provider.js";
import type { ModelProvider } from "../src/provider.js";

test("interactive runtime generates one chapter at a time and persists feedback", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "novel-agents-test-"));
  try {
    const agent = new NovelAgent(new MockProvider(), {
      outputRoot,
      maxRevisions: 1,
      maxProviderRetries: 0,
      uiLocale: "zh-CN",
      promptLocale: "zh-CN",
      outputLanguage: "zh-CN",
    });
    const prepared = await agent.prepare("写一个两章悬疑故事");
    const feedback = await agent.handleUserMessage(
      prepared.state,
      prepared.store,
      "/next 加强雨夜氛围",
    );
    assert.equal(feedback.state.feedback[0]?.status, "pending");

    const first = await agent.handleUserMessage(
      feedback.state,
      prepared.store,
      "/continue",
    );
    assert.equal(first.state.chapters.length, 1);
    assert.equal(first.state.status, "paused");
    assert.equal(first.state.feedback[0]?.status, "applied");
    assert.equal(first.state.feedback[0]?.appliedToChapter, 1);

    const second = await agent.handleUserMessage(
      first.state,
      prepared.store,
      "/continue",
    );
    assert.equal(second.state.chapters.length, 2);
    assert.equal(second.state.status, "complete");
    assert.ok(second.state.conversation.length >= 6);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("run lock serializes concurrent continue operations and reloads fresh state", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "novel-agents-lock-test-"));
  try {
    const agent = new NovelAgent(new MockProvider(), {
      outputRoot,
      maxRevisions: 1,
      maxProviderRetries: 0,
      uiLocale: "zh-CN",
      promptLocale: "zh-CN",
      outputLanguage: "zh-CN",
    });
    const prepared = await agent.prepare("写一个两章悬疑故事");
    await Promise.all([
      agent.runNextChapter(prepared.state, prepared.store),
      agent.runNextChapter(prepared.state, prepared.store),
    ]);
    const persisted = await prepared.store.loadState();
    assert.deepEqual(
      persisted.chapters.map((chapter) => chapter.number),
      [1, 2],
    );
    assert.equal(persisted.status, "complete");
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("persists a natural-language user message before intent routing", async () => {
  const outputRoot = await mkdtemp(
    join(tmpdir(), "novel-agents-message-test-"),
  );
  try {
    const options = {
      outputRoot,
      maxRevisions: 1,
      maxProviderRetries: 0,
      uiLocale: "zh-CN" as const,
      promptLocale: "zh-CN" as const,
      outputLanguage: "zh-CN",
    };
    const preparingAgent = new NovelAgent(new MockProvider(), options);
    const prepared = await preparingAgent.prepare("写一个两章悬疑故事");
    const failingProvider: ModelProvider = {
      name: "failing",
      async complete() {
        throw new Error("ROUTER_UNAVAILABLE");
      },
    };
    const routingAgent = new NovelAgent(failingProvider, options);
    await assert.rejects(
      routingAgent.handleUserMessage(
        prepared.state,
        prepared.store,
        "下一章节奏慢一点",
      ),
      /ROUTER_UNAVAILABLE/u,
    );
    const persisted = await prepared.store.loadState();
    assert.equal(persisted.conversation.at(-1)?.content, "下一章节奏慢一点");
    assert.equal(persisted.conversation.at(-1)?.intent, null);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("configured output language overrides a provider's proposed specification language", async () => {
  const outputRoot = await mkdtemp(
    join(tmpdir(), "novel-agents-language-test-"),
  );
  try {
    const agent = new NovelAgent(new MockProvider(), {
      outputRoot,
      maxRevisions: 1,
      maxProviderRetries: 0,
      uiLocale: "en-US",
      promptLocale: "en-US",
      outputLanguage: "ja-JP",
    });
    const prepared = await agent.prepare(
      "Write a two-chapter mystery in Japanese",
    );
    assert.equal(prepared.state.spec?.language, "ja-JP");
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
