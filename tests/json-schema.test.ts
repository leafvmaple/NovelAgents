import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import {
  ChapterMemorySchema,
  ChapterReviewSchema,
  NovelSpecSchema,
  StoryBlueprintSchema,
} from "../src/domain.js";
import { createOpenAiOutputSchema } from "../src/json-schema.js";

function findBooleanExclusiveBounds(value: unknown, path = "schema"): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => findBooleanExclusiveBounds(item, `${path}[${index}]`));
  }
  if (typeof value !== "object" || value === null) return [];

  return Object.entries(value).flatMap(([key, child]) => {
    const childPath = `${path}.${key}`;
    const current =
      (key === "exclusiveMinimum" || key === "exclusiveMaximum") && typeof child === "boolean"
        ? [childPath]
        : [];
    return [...current, ...findBooleanExclusiveBounds(child, childPath)];
  });
}

test("converts legacy boolean exclusive bounds to numeric JSON Schema bounds", () => {
  const schema = createOpenAiOutputSchema(
    z.object({ positive: z.number().positive(), belowTen: z.number().max(10) }).strict(),
  );
  const properties = schema.properties as Record<string, Record<string, unknown>>;
  const positive = properties.positive;
  const belowTen = properties.belowTen;
  assert.ok(positive);
  assert.ok(belowTen);

  assert.equal(positive.exclusiveMinimum, 0);
  assert.equal("minimum" in positive, false);
  assert.equal(belowTen.maximum, 10);
});

test("all model-facing schemas avoid legacy boolean exclusive bounds", () => {
  const schemas = [NovelSpecSchema, StoryBlueprintSchema, ChapterReviewSchema, ChapterMemorySchema];
  for (const schema of schemas) {
    assert.deepEqual(findBooleanExclusiveBounds(createOpenAiOutputSchema(schema)), []);
  }
});
