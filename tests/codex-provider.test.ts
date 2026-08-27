import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCodexPrompt } from "../src/codex-provider.js";

describe("Codex provider prompt", () => {
  it("preserves message roles and inference-only boundaries", () => {
    const prompt = buildCodexPrompt({
      purpose: "test-json",
      json: true,
      outputSchema: { type: "object" },
      temperature: 0,
      maxTokens: 100,
      messages: [
        { role: "system", content: "system rule" },
        { role: "user", content: "user request" },
      ],
    });
    assert.match(prompt, /不要读取工作区文件/u);
    assert.match(prompt, /符合输出 Schema 的 JSON/u);
    assert.match(prompt, /role="system">\nsystem rule/u);
    assert.match(prompt, /role="user">\nuser request/u);
  });
});
