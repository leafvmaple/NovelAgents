import { Codex } from "@openai/codex-sdk";
import type { CompletionRequest, ModelProvider } from "./provider.js";
import { codexBackendPrompt } from "./prompts/codex-backend.js";

type CodexProviderOptions = {
  model: string;
  timeoutMs: number;
  workingDirectory: string;
};

function reasoningEffort(purpose: string) {
  if (
    purpose === "analyze-request" ||
    purpose.includes("memory-") ||
    purpose.endsWith("-repair")
  ) {
    return "low" as const;
  }
  if (purpose.includes("draft-") || purpose.includes("revise-")) {
    return "low" as const;
  }
  return "medium" as const;
}

export function buildCodexPrompt(request: CompletionRequest) {
  return codexBackendPrompt(request);
}

export class CodexProvider implements ModelProvider {
  readonly name = "codex";
  private readonly codex = new Codex();

  constructor(private readonly options: CodexProviderOptions) {}

  async complete(request: CompletionRequest) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const thread = this.codex.startThread({
        model: this.options.model,
        modelReasoningEffort: reasoningEffort(request.purpose),
        sandboxMode: "read-only",
        workingDirectory: this.options.workingDirectory,
        skipGitRepoCheck: true,
        networkAccessEnabled: false,
        webSearchMode: "disabled",
        approvalPolicy: "never",
      });
      const turn = await thread.run(buildCodexPrompt(request), {
        signal: controller.signal,
        ...(request.outputSchema ? { outputSchema: request.outputSchema } : {}),
      });
      const content = turn.finalResponse.trim();
      if (!content) throw new Error("CODEX_RESPONSE_EMPTY");
      const inputTokens = turn.usage?.input_tokens ?? null;
      const outputTokens = turn.usage?.output_tokens ?? null;
      const reasoningTokens = turn.usage?.reasoning_output_tokens ?? 0;
      return {
        content,
        model: this.options.model,
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens:
            inputTokens === null || outputTokens === null
              ? null
              : inputTokens + outputTokens + reasoningTokens,
        },
      };
    } catch (error) {
      if (controller.signal.aborted) throw new Error("CODEX_REQUEST_TIMEOUT");
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`CODEX_REQUEST_FAILED:${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
