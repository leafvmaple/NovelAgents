import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { extractJson, parseModelJson } from "../src/json.js";

describe("model JSON parsing", () => {
  it("extracts JSON from a Markdown fence", () => {
    assert.deepEqual(extractJson('```json\n{"ok":true}\n```'), { ok: true });
  });

  it("extracts an object surrounded by prose", () => {
    assert.deepEqual(extractJson('result: {"value":3} done'), { value: 3 });
  });

  it("validates the extracted shape", () => {
    const schema = z.object({ value: z.number() }).strict();
    assert.deepEqual(parseModelJson(schema, '{"value":7}'), { value: 7 });
  });

  it("unwraps a common model response envelope", () => {
    const schema = z.object({ value: z.number() }).strict();
    assert.deepEqual(parseModelJson(schema, '{"response":{"value":7}}'), {
      value: 7,
    });
  });

  it("repairs minor JSON syntax errors locally", () => {
    const schema = z.object({ values: z.array(z.string()) }).strict();
    assert.deepEqual(parseModelJson(schema, '{"values":["a" "b"]}'), {
      values: ["a", "b"],
    });
  });

  it("unwraps a singleton array around an object", () => {
    const schema = z.object({ value: z.number() }).strict();
    assert.deepEqual(parseModelJson(schema, '[{"value":7}]'), { value: 7 });
  });
});
