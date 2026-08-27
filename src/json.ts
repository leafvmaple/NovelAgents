import type { z } from "zod";
import { jsonrepair } from "jsonrepair";

function stripCodeFence(value: string) {
  const match = value.match(/```(?:json)?\s*([\s\S]*?)```/iu);
  return match?.[1]?.trim() ?? value.trim();
}

function unwrapEnvelope(value: unknown): unknown {
  let current = value;
  const envelopeKeys = new Set([
    "response",
    "data",
    "result",
    "output",
    "json",
  ]);
  for (let depth = 0; depth < 3; depth += 1) {
    if (Array.isArray(current)) {
      if (current.length !== 1) return current;
      current = current[0];
      continue;
    }
    if (!current || typeof current !== "object") return current;
    const record = current as Record<string, unknown>;
    const keys = Object.keys(record);
    const key = keys[0] ?? "";
    if (keys.length !== 1 || !envelopeKeys.has(key)) return current;
    const nested = record[key];
    if (typeof nested === "string") {
      try {
        current = JSON.parse(stripCodeFence(nested));
        continue;
      } catch {
        return current;
      }
    }
    current = nested;
  }
  return current;
}

function parseCandidate(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return JSON.parse(jsonrepair(value)) as unknown;
  }
}

export function extractJson(value: string): unknown {
  const candidate = stripCodeFence(value);
  const candidates = [candidate];
  const objectStart = candidate.indexOf("{");
  const objectEnd = candidate.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(candidate.slice(objectStart, objectEnd + 1));
  }
  const arrayStart = candidate.indexOf("[");
  const arrayEnd = candidate.lastIndexOf("]");
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    candidates.push(candidate.slice(arrayStart, arrayEnd + 1));
  }
  for (const jsonCandidate of [...new Set(candidates)]) {
    try {
      return unwrapEnvelope(parseCandidate(jsonCandidate));
    } catch {
      continue;
    }
  }
  throw new Error("MODEL_RESPONSE_JSON_MISSING");
}

export function parseModelJson<Output, Input>(
  schema: z.ZodType<Output, z.ZodTypeDef, Input>,
  value: string,
): Output {
  return schema.parse(extractJson(value));
}
