import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import { loadConfig } from "../src/config.js";

test("configuration can be loaded from an injected environment without module side effects", () => {
  const cwd = resolve("test-workspace");
  const config = loadConfig(
    false,
    {
      NOVEL_AGENT_PROVIDER: "mock",
      NOVEL_AGENT_OUTPUT_DIR: "artifacts",
      NOVEL_AGENT_TRACE_CONTENT: "yes",
    },
    cwd,
  );
  assert.equal(config.provider, "mock");
  assert.equal(config.outputRoot, resolve(cwd, "artifacts"));
  assert.equal(config.traceContent, true);
});
