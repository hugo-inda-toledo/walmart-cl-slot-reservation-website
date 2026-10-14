import type { ApiError } from "./apiError";

export interface RetryPolicy {
  readonly maxNetworkRetries: number;
  readonly networkBackoffMs: readonly number[];
  readonly maxInProgressRetries: number;
  readonly maxWaitSeconds: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxNetworkRetries: 2,
  networkBackoffMs: [500, 1000],
  maxInProgressRetries: 3,
  maxWaitSeconds: 10,
};

type Sleep = (ms: number) => Promise<void>;

const defaultSleep: Sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

function isNetworkError(
  error: unknown,
): error is Extract<ApiError, { kind: "network" }> {
  return (
    error !== null &&
    typeof error === "object" &&
    "kind" in error &&
    error.kind === "network"
  );
}

function inProgressRetryAfterSeconds(error: unknown): number | undefined {
  if (
    error === null ||
    typeof error !== "object" ||
    !("kind" in error) ||
    error.kind !== "problem" ||
    !("problem" in error) ||
    error.problem === null ||
    typeof error.problem !== "object" ||
    !("code" in error.problem) ||
    error.problem.code !== "IDEMPOTENCY_REQUEST_IN_PROGRESS" ||
    !("retryAfterSeconds" in error.problem) ||
    typeof error.problem.retryAfterSeconds !== "number"
  ) {
    return undefined;
  }

  return error.problem.retryAfterSeconds;
}

export async function withIdempotentRetry<T>(
  operation: () => Promise<T>,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  sleep: Sleep = defaultSleep,
): Promise<T> {
  let networkRetries = 0;
  let inProgressRetries = 0;

  for (;;) {
    try {
      return await operation();
    } catch (error) {
      if (
        isNetworkError(error) &&
        error.reason !== "aborted" &&
        networkRetries < policy.maxNetworkRetries
      ) {
        const backoffMs = policy.networkBackoffMs[networkRetries] ?? 0;
        networkRetries += 1;
        await sleep(backoffMs);
        continue;
      }

      const retryAfterSeconds = inProgressRetryAfterSeconds(error);
      if (
        retryAfterSeconds !== undefined &&
        inProgressRetries < policy.maxInProgressRetries
      ) {
        inProgressRetries += 1;
        await sleep(Math.min(retryAfterSeconds, policy.maxWaitSeconds) * 1000);
        continue;
      }

      throw error;
    }
  }
}
