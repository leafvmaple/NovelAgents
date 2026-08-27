import { Codex } from "@openai/codex-sdk";
import type { CompletionRequest, ModelProvider } from "./provider.js";
import { codexBackendPrompt } from "./prompts/codex-backend.js";
import { ProviderError } from "./errors/provider-error.js";

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

  async complete(request: CompletionRequest, externalSignal?: AbortSignal) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs,
    );
    const signal = externalSignal
      ? AbortSignal.any([controller.signal, externalSignal])
      : controller.signal;
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
        signal,
        ...(request.outputSchema ? { outputSchema: request.outputSchema } : {}),
      });
      const content = turn.finalResponse.trim();
      if (!content) throw new ProviderError(this.name, "EMPTY_RESPONSE", true);
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
      if (error instanceof ProviderError) throw error;
      if (externalSignal?.aborted)
        throw new ProviderError(
          this.name,
          "CANCELLED",
          false,
          null,
          "request cancelled",
          { cause: error },
        );
      if (controller.signal.aborted)
        throw new ProviderError(
          this.name,
          "TIMEOUT",
          true,
          null,
          "request timed out",
          { cause: error },
        );
      const message = error instanceof Error ? error.message : String(error);
      const retryable =
        /(?:429|5\d\d|temporar|overload|unavailable|connection|reset)/iu.test(
          message,
        );
      throw new ProviderError(
        this.name,
        "SDK_ERROR",
        retryable,
        null,
        message,
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
