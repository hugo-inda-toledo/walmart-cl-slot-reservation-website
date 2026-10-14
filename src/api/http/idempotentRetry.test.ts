import { describe, expect, it, vi } from "vitest";

import { DEFAULT_RETRY_POLICY, withIdempotentRetry } from "./idempotentRetry";

const networkError = { kind: "network", reason: "offline" } as const;
const inProgressError = {
  kind: "problem",
  problem: {
    status: 409,
    code: "IDEMPOTENCY_REQUEST_IN_PROGRESS",
    title: "Solicitud en curso",
    retryAfterSeconds: 12,
    fieldErrors: [],
  },
} as const;

describe("withIdempotentRetry", () => {
  it("retries network failures twice with the configured backoff", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(networkError)
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue("held");
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue();

    await expect(
      withIdempotentRetry(operation, undefined, sleep),
    ).resolves.toBe("held");

    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 500);
    expect(sleep).toHaveBeenNthCalledWith(2, 1000);
  });

  it("propagates the network error after exactly two retries", async () => {
    const operation = vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(networkError);
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue();

    await expect(withIdempotentRetry(operation, undefined, sleep)).rejects.toBe(
      networkError,
    );

    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("propagates in-progress after exactly three waits", async () => {
    const operation = vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(inProgressError);
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue();

    await expect(withIdempotentRetry(operation, undefined, sleep)).rejects.toBe(
      inProgressError,
    );

    expect(operation).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(3);
  });

  it("never retries a caller abort", async () => {
    const aborted = { kind: "network", reason: "aborted" } as const;
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(aborted);
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue();

    await expect(withIdempotentRetry(operation, undefined, sleep)).rejects.toBe(
      aborted,
    );

    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("waits for the API-indicated duration capped at ten seconds before three in-progress retries", async () => {
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(inProgressError)
      .mockRejectedValueOnce(inProgressError)
      .mockRejectedValueOnce(inProgressError)
      .mockResolvedValue("confirmed");
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue();

    await expect(
      withIdempotentRetry(operation, undefined, sleep),
    ).resolves.toBe("confirmed");

    expect(operation).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 10_000);
    expect(sleep).toHaveBeenNthCalledWith(2, 10_000);
    expect(sleep).toHaveBeenNthCalledWith(3, 10_000);
  });

  it("uses real timer scheduling for the default network backoff", async () => {
    vi.useFakeTimers();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue("held");

    const result = withIdempotentRetry(operation);
    await vi.advanceTimersByTimeAsync(500);

    await expect(result).resolves.toBe("held");
    expect(operation).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("propagates business errors immediately without waiting or retrying", async () => {
    const businessError = {
      kind: "problem",
      problem: {
        status: 409,
        code: "SLOT_FULL",
        title: "Agotado",
        slotId: "slot-1",
        alternatives: [],
        fieldErrors: [],
      },
    } as const;
    const operation = vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(businessError);
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue();

    await expect(withIdempotentRetry(operation, undefined, sleep)).rejects.toBe(
      businessError,
    );

    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("exposes the documented default policy", () => {
    expect(DEFAULT_RETRY_POLICY).toEqual({
      maxNetworkRetries: 2,
      networkBackoffMs: [500, 1000],
      maxInProgressRetries: 3,
      maxWaitSeconds: 10,
    });
  });
});
