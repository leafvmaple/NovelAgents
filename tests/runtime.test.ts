import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { NovelAgent } from "../src/agent.js";
import { MockProvider } from "../src/provider.js";

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
    const feedback = await agent.handleUserMessage(prepared.state, prepared.store, "/next 加强雨夜氛围");
    assert.equal(feedback.state.feedback[0]?.status, "pending");

    const first = await agent.handleUserMessage(feedback.state, prepared.store, "/continue");
    assert.equal(first.state.chapters.length, 1);
    assert.equal(first.state.status, "paused");
    assert.equal(first.state.feedback[0]?.status, "applied");
    assert.equal(first.state.feedback[0]?.appliedToChapter, 1);

    const second = await agent.handleUserMessage(first.state, prepared.store, "/continue");
    assert.equal(second.state.chapters.length, 2);
    assert.equal(second.state.status, "complete");
    assert.ok(second.state.conversation.length >= 6);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
