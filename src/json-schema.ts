import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

type JsonObject = Record<string, unknown>;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeExclusiveBounds(value: unknown, path = "schema"): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeExclusiveBounds(item, `${path}[${index}]`));
  }
  if (!isJsonObject(value)) return value;

  const normalized: JsonObject = {};
  for (const [key, child] of Object.entries(value)) {
    normalized[key] = normalizeExclusiveBounds(child, `${path}.${key}`);
  }

  for (const [exclusiveKey, inclusiveKey] of [
    ["exclusiveMinimum", "minimum"],
    ["exclusiveMaximum", "maximum"],
  ] as const) {
    const exclusiveValue = normalized[exclusiveKey];
    if (typeof exclusiveValue !== "boolean") continue;

    if (!exclusiveValue) {
      delete normalized[exclusiveKey];
      continue;
    }

    const inclusiveValue = normalized[inclusiveKey];
    if (typeof inclusiveValue !== "number") {
      throw new Error(`JSON_SCHEMA_BOOLEAN_BOUND_WITHOUT_NUMBER:${path}.${exclusiveKey}`);
    }
    normalized[exclusiveKey] = inclusiveValue;
    delete normalized[inclusiveKey];
  }

  return normalized;
}

export function createOpenAiOutputSchema(schema: z.ZodTypeAny): JsonObject {
  const generated = zodToJsonSchema(schema, { target: "openAi" });
  const normalized = normalizeExclusiveBounds(generated);
  if (!isJsonObject(normalized)) throw new Error("JSON_SCHEMA_ROOT_MUST_BE_OBJECT");
  return normalized;
}
