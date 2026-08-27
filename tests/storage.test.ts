import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { NovelAgent } from "../src/agent.js";
import { MockProvider } from "../src/provider.js";

const secret = "PRIVATE-STORY-IDEA-9284";

async function prepareWithTracePolicy(
  outputRoot: string,
  traceContent: boolean,
) {
  const agent = new NovelAgent(new MockProvider(), {
    outputRoot,
    maxRevisions: 1,
    maxProviderRetries: 0,
    uiLocale: "zh-CN",
    promptLocale: "zh-CN",
    outputLanguage: "zh-CN",
    traceContent,
  });
  return agent.prepare(`写一个故事，私人标记是 ${secret}`);
}

test("metadata trace mode redacts prompts and model responses by default", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "novel-agents-trace-test-"));
  try {
    const prepared = await prepareWithTracePolicy(outputRoot, false);
    const trace = await readFile(prepared.store.tracePath, "utf8");
    assert.doesNotMatch(trace, new RegExp(secret, "u"));
    assert.match(trace, /\[redacted\]/u);
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("full trace mode is an explicit opt-in", async () => {
  const outputRoot = await mkdtemp(
    join(tmpdir(), "novel-agents-full-trace-test-"),
  );
  try {
    const prepared = await prepareWithTracePolicy(outputRoot, true);
    const trace = await readFile(prepared.store.tracePath, "utf8");
    assert.match(trace, new RegExp(secret, "u"));
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
