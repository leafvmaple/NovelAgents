import assert from "node:assert/strict";
import test from "node:test";
import { ProviderError } from "../src/errors/provider-error.js";
import { OpenRouterProvider } from "../src/provider.js";

const request = {
  purpose: "test",
  messages: [{ role: "user" as const, content: "hello" }],
  json: false,
  temperature: 0,
  maxTokens: 10,
};

test("OpenRouter preserves retryable HTTP status when an error body is HTML", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("<html>bad gateway</html>", { status: 502, statusText: "Bad Gateway" });
  try {
    const provider = new OpenRouterProvider({ apiKey: "test", baseUrl: "https://example.test", model: "test", timeoutMs: 5000 });
    await assert.rejects(
      provider.complete(request),
      (error: unknown) => error instanceof ProviderError
        && error.code === "HTTP_ERROR"
        && error.status === 502
        && error.retryable,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("OpenRouter reports malformed successful responses as structured errors", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("not-json", { status: 200 });
  try {
    const provider = new OpenRouterProvider({ apiKey: "test", baseUrl: "https://example.test", model: "test", timeoutMs: 5000 });
    await assert.rejects(
      provider.complete(request),
      (error: unknown) => error instanceof ProviderError
        && error.code === "INVALID_RESPONSE"
        && error.retryable,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
