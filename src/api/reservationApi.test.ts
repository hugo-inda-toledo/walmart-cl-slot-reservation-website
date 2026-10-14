import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { HttpClient, RequestOptions } from "./http/httpClient";
import { createReservationApi } from "./reservationApi";

const networkError = { kind: "network", reason: "offline" } as const;
const inProgress = {
  kind: "problem",
  problem: {
    status: 409,
    code: "IDEMPOTENCY_REQUEST_IN_PROGRESS",
    title: "En curso",
    retryAfterSeconds: 1,
    fieldErrors: [],
  },
} as const;

type Outcome = "ok" | typeof networkError | typeof inProgress;

function stubHttp(outcomes: readonly Outcome[]) {
  const calls: RequestOptions[] = [];
  let index = 0;
  const http: HttpClient = {
    clock: { now: () => 0, observe: () => undefined },
    request: (options) => {
      calls.push(options);
      const outcome = outcomes[Math.min(index++, outcomes.length - 1)];
      if (outcome === "ok" || outcome === undefined)
        return Promise.resolve({
          data: undefined as never,
          meta: { status: 200 },
        });
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      return Promise.reject(outcome);
    },
  };
  return { http, calls };
}

async function settle<T>(promise: Promise<T>, advanceMs: number) {
  const outcome = promise.then(
    () => ({ ok: true as const }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.advanceTimersByTimeAsync(advanceMs);
  return outcome;
}

describe("reservationApi retries", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reintenta createHold con la misma Idempotency-Key y el mismo cuerpo", async () => {
    const { http, calls } = stubHttp([networkError, networkError, "ok"]);
    const api = createReservationApi(http);

    const result = await settle(
      api.createHold("c-1", "key-1", { slotId: "s", orderId: "o" }),
      2_000,
    );

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(3);
    expect(new Set(calls.map((call) => call.idempotencyKey))).toEqual(
      new Set(["key-1"]),
    );
    expect(calls.every((call) => call.body === calls[0]?.body)).toBe(true);
  });

  it("reintenta confirmHold ante 'en curso' con la misma clave", async () => {
    const { http, calls } = stubHttp([inProgress, "ok"]);
    const api = createReservationApi(http);

    const result = await settle(api.confirmHold("c-1", "h-1", "key-2"), 1_000);

    expect(result.ok).toBe(true);
    expect(calls.map((call) => call.idempotencyKey)).toEqual([
      "key-2",
      "key-2",
    ]);
  });

  it("agota los reintentos de red de createHold y propaga el error", async () => {
    const { http, calls } = stubHttp([networkError]);
    const api = createReservationApi(http);

    const result = await settle(
      api.createHold("c-1", "key-3", { slotId: "s", orderId: "o" }),
      5_000,
    );

    expect(result).toEqual({ ok: false, error: networkError });
    expect(calls).toHaveLength(3);
  });

  it("releaseHold solo reintenta red y nunca 'en curso'", async () => {
    const withNetwork = stubHttp([networkError, "ok"]);
    const resultNetwork = await settle(
      createReservationApi(withNetwork.http).releaseHold("c-1", "h-1"),
      1_000,
    );
    expect(resultNetwork.ok).toBe(true);
    expect(withNetwork.calls).toHaveLength(2);
    expect(withNetwork.calls[0]?.idempotencyKey).toBeUndefined();

    const withProgress = stubHttp([inProgress, "ok"]);
    const resultProgress = await settle(
      createReservationApi(withProgress.http).releaseHold("c-1", "h-1"),
      5_000,
    );
    expect(resultProgress).toEqual({ ok: false, error: inProgress });
    expect(withProgress.calls).toHaveLength(1);
  });
});
