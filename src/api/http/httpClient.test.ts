import { describe, expect, it, vi } from "vitest";

import { createHttpClient } from "./httpClient";
import { createServerClock } from "./serverClock";

function response(body: BodyInit | null, init: ResponseInit = {}): Response {
  return new Response(body, init);
}

describe("HttpClient", () => {
  it("builds an encoded URL and only sends optional identity headers when supplied", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(JSON.stringify({ region: "RM" }), {
          status: 200,
          headers: { Date: "Mon, 12 Oct 2026 12:00:00 GMT" },
        }),
      )
      .mockResolvedValueOnce(response(JSON.stringify([]), { status: 200 }));
    const client = createHttpClient({
      baseUrl: "https://api.example/",
      fetchFn,
    });

    await client.request({
      method: "POST",
      path: "/api/v1/addresses",
      query: { comuna: "Ñuñoa & Centro", skipped: undefined },
      body: { street: "Irarrázaval" },
      customerId: "customer-1",
      idempotencyKey: "key-1",
    });

    const [url, init] = fetchFn.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://api.example/api/v1/addresses?comuna=%C3%91u%C3%B1oa+%26+Centro",
    );
    expect(init?.headers).toMatchObject({
      Accept: "application/json, application/problem+json",
      "Content-Type": "application/json",
      "X-Customer-Id": "customer-1",
      "Idempotency-Key": "key-1",
    });
    const correlationId = (
      init?.headers as Record<string, unknown> | undefined
    )?.["X-Correlation-Id"];
    expect(correlationId).toEqual(expect.stringMatching(/^web-[A-Z2-7]{22}$/));
    expect(init?.body).toBe(JSON.stringify({ street: "Irarrázaval" }));

    await client.request({ method: "GET", path: "/api/v1/regions" });
    const [, withoutOptionalHeaders] = fetchFn.mock.calls[1] ?? [];
    expect(withoutOptionalHeaders?.headers).not.toHaveProperty("X-Customer-Id");
    expect(withoutOptionalHeaders?.headers).not.toHaveProperty(
      "Idempotency-Key",
    );
  });

  it("returns undefined for 204 and response metadata", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      response(null, {
        status: 204,
        headers: {
          "X-Correlation-Id": "server-correlation",
          "Retry-After": "4",
        },
      }),
    );
    const client = createHttpClient({ baseUrl: "", fetchFn });

    await expect(
      client.request({ method: "DELETE", path: "/api/v1/holds/h1" }),
    ).resolves.toEqual({
      data: undefined,
      meta: {
        status: 204,
        correlationId: "server-correlation",
        retryAfterSeconds: 4,
      },
    });
  });

  it("maps problem details and malformed error bodies to typed API errors", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response(
          JSON.stringify({ title: "No válido", code: "INVALID_CUSTOMER_ID" }),
          {
            status: 400,
            headers: {
              "content-type": "application/problem+json",
              "X-Correlation-Id": "problem-id",
            },
          },
        ),
      )
      .mockResolvedValueOnce(
        response("<html>gateway</html>", {
          status: 502,
          headers: {
            "content-type": "text/html",
            "X-Correlation-Id": "gateway-id",
          },
        }),
      );
    const client = createHttpClient({ baseUrl: "", fetchFn });

    await expect(
      client.request({ method: "GET", path: "/problem" }),
    ).rejects.toMatchObject({
      kind: "problem",
      problem: { code: "INVALID_CUSTOMER_ID", correlationId: "problem-id" },
    });
    await expect(
      client.request({ method: "GET", path: "/html" }),
    ).rejects.toEqual({
      kind: "unexpectedResponse",
      status: 502,
      correlationId: "gateway-id",
    });
  });

  it("converts a fetch TypeError into an offline network error", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new TypeError("Failed to fetch"));
    const client = createHttpClient({ baseUrl: "", fetchFn });

    await expect(
      client.request({ method: "GET", path: "/offline" }),
    ).rejects.toEqual({
      kind: "network",
      reason: "offline",
    });
  });

  it("aborts the request after the configured timeout", async () => {
    vi.useFakeTimers();
    const fetchFn = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    const client = createHttpClient({
      baseUrl: "",
      timeoutMs: 10_000,
      fetchFn,
    });
    const request = client.request({ method: "GET", path: "/slow" });

    const outcome = expect(request).rejects.toEqual({
      kind: "network",
      reason: "timeout",
    });
    await vi.advanceTimersByTimeAsync(10_000);
    await outcome;
    vi.useRealTimers();
  });
});

describe("HttpClient clock and malformed bodies", () => {
  it("feeds the server clock from the Date header and resets without it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-12T12:00:00Z"));
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response("{}", {
          status: 200,
          headers: { Date: "Mon, 12 Oct 2026 12:05:00 GMT" },
        }),
      )
      .mockResolvedValueOnce(response("{}", { status: 200 }));
    const client = createHttpClient({ baseUrl: "", fetchFn });

    await client.request({ method: "GET", path: "/a" });
    expect(client.clock.now()).toBe(Date.parse("2026-10-12T12:05:00Z"));

    await client.request({ method: "GET", path: "/b" });
    expect(client.clock.now()).toBe(Date.parse("2026-10-12T12:00:00Z"));
    vi.useRealTimers();
  });

  it("maps a 2xx with a non-JSON body to unexpectedResponse", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response("<html>", { status: 200 }));
    const client = createHttpClient({ baseUrl: "", fetchFn });

    await expect(
      client.request({ method: "GET", path: "/x" }),
    ).rejects.toMatchObject({ kind: "unexpectedResponse", status: 200 });
  });

  it("maps a problem+json response with an invalid body to unexpectedResponse", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(
      response("not json", {
        status: 500,
        headers: { "content-type": "application/problem+json" },
      }),
    );
    const client = createHttpClient({ baseUrl: "", fetchFn });

    await expect(
      client.request({ method: "GET", path: "/x" }),
    ).rejects.toMatchObject({ kind: "unexpectedResponse", status: 500 });
  });

  it("reports a caller abort as aborted, not offline", async () => {
    const controller = new AbortController();
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("aborted", "AbortError"));
          });
        }),
    );
    const client = createHttpClient({ baseUrl: "", fetchFn });

    const request = client.request({
      method: "GET",
      path: "/x",
      signal: controller.signal,
    });
    controller.abort();

    await expect(request).rejects.toEqual({
      kind: "network",
      reason: "aborted",
    });
  });
});

describe("ServerClock", () => {
  it("uses the response midpoint to estimate the server offset and resets to zero without Date", () => {
    let deviceNow = 2_000;
    const clock = createServerClock(() => deviceNow);

    clock.observe("Thu, 01 Jan 1970 00:00:03 GMT", 1_000, 2_000);
    expect(clock.now()).toBe(3_500);

    deviceNow = 4_000;
    expect(clock.now()).toBe(5_500);
    clock.observe(null, 4_000, 4_000);
    expect(clock.now()).toBe(4_000);
  });
});
