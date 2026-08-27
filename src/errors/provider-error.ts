export type ProviderErrorCode =
  | "HTTP_ERROR"
  | "NETWORK_ERROR"
  | "TIMEOUT"
  | "EMPTY_RESPONSE"
  | "INVALID_RESPONSE"
  | "SDK_ERROR";

export class ProviderError extends Error {
  constructor(
    readonly provider: string,
    readonly code: ProviderErrorCode,
    readonly retryable: boolean,
    readonly status: number | null = null,
    detail = "",
    options?: ErrorOptions,
  ) {
    super(
      `${provider}:${code}${status === null ? "" : `:${status}`}${detail ? `:${detail}` : ""}`,
      options,
    );
    this.name = "ProviderError";
  }
}
