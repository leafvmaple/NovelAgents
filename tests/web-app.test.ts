import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadConfig } from "../src/config.js";
import { MockProvider } from "../src/provider.js";
import { buildWebApp } from "../src/web-app.js";

test("Web API creates a run and accepts deterministic chat commands", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "novel-agents-web-test-"));
  const config = loadConfig(true, { NOVEL_AGENT_OUTPUT_DIR: outputRoot });
  const app = buildWebApp(config, new MockProvider());
  try {
    const created = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { request: "写一个两章悬疑故事" },
    });
    assert.equal(created.statusCode, 200);
    const createdBody = created.json<{
      state: { id: string; status: string };
    }>();
    assert.equal(createdBody.state.status, "awaiting_confirmation");

    const continued = await app.inject({
      method: "POST",
      url: `/api/runs/${createdBody.state.id}/messages`,
      payload: { message: "/continue" },
    });
    assert.equal(continued.statusCode, 200);
    const continuedBody = continued.json<{
      state: { chapters: unknown[]; status: string };
    }>();
    assert.equal(continuedBody.state.chapters.length, 1);
    assert.equal(continuedBody.state.status, "paused");
  } finally {
    await app.close();
    await rm(outputRoot, { recursive: true, force: true });
  }
});

test("Web API validates empty novel requests", async () => {
  const outputRoot = await mkdtemp(
    join(tmpdir(), "novel-agents-web-validation-test-"),
  );
  const config = loadConfig(true, { NOVEL_AGENT_OUTPUT_DIR: outputRoot });
  const app = buildWebApp(config, new MockProvider());
  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/runs",
      payload: { request: "" },
    });
    assert.equal(response.statusCode, 400);
  } finally {
    await app.close();
    await rm(outputRoot, { recursive: true, force: true });
  }
});
