import { describe, expect, it } from "vitest";

import { newCorrelationId, newIdempotencyKey, newOrderId } from "./randomIds";

const OPAQUE_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/u;

describe("random identifiers", () => {
  it("creates distinct idempotency keys within the API length limit", () => {
    const first = newIdempotencyKey();
    const second = newIdempotencyKey();

    expect(first).toMatch(/^wk-[0-9a-f]{32}$/u);
    expect(first.length).toBeLessThanOrEqual(128);
    expect(second).not.toBe(first);
  });

  it("creates distinct opaque order ids valid for one checkout", () => {
    const first = newOrderId();
    const second = newOrderId();

    expect(first).toMatch(OPAQUE_ID_PATTERN);
    expect(first).toMatch(/^web-/u);
    expect(second).not.toBe(first);
  });

  it("creates distinct opaque correlation ids", () => {
    const first = newCorrelationId();
    const second = newCorrelationId();

    expect(first).toMatch(OPAQUE_ID_PATTERN);
    expect(first).toMatch(/^web-/u);
    expect(second).not.toBe(first);
  });
});
