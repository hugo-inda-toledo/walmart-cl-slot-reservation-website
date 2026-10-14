import { newCorrelationId } from "@/shared/ids/randomIds";

import { parseApiError, type ApiError } from "./apiError";
import { createServerClock, type ServerClock } from "./serverClock";

const DEFAULT_TIMEOUT_MS = 10_000;

export interface RequestOptions {
  readonly method: "GET" | "POST" | "DELETE";
  readonly path: string;
  readonly query?: Readonly<Record<string, string | number | undefined>>;
  readonly body?: unknown;
  readonly customerId?: string;
  readonly idempotencyKey?: string;
  readonly signal?: AbortSignal;
}

export interface ResponseMeta {
  readonly status: number;
  readonly correlationId?: string;
  readonly retryAfterSeconds?: number;
}

export interface HttpResponse<T> {
  readonly data: T;
  readonly meta: ResponseMeta;
}

export interface HttpClient {
  request<T>(options: RequestOptions): Promise<HttpResponse<T>>;
  readonly clock: ServerClock;
}

interface HttpClientConfig {
  readonly baseUrl: string;
  readonly timeoutMs?: number;
  readonly fetchFn?: typeof fetch;
}

function requestUrl(
  baseUrl: string,
  path: string,
  query: RequestOptions["query"],
): string {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  if (query === undefined) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const search = params.toString();
  return search === "" ? url : `${url}?${search}`;
}

function responseMeta(response: Response): ResponseMeta {
  const correlationId = response.headers.get("X-Correlation-Id") ?? undefined;
  const retryAfter = Number(response.headers.get("Retry-After"));
  return {
    status: response.status,
    ...(correlationId === undefined ? {} : { correlationId }),
    ...(Number.isFinite(retryAfter) && retryAfter > 0
      ? { retryAfterSeconds: retryAfter }
      : {}),
  };
}

function headersFor(options: RequestOptions): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json, application/problem+json",
    "X-Correlation-Id": newCorrelationId(),
  };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.customerId !== undefined)
    headers["X-Customer-Id"] = options.customerId;
  if (options.idempotencyKey !== undefined)
    headers["Idempotency-Key"] = options.idempotencyKey;
  return headers;
}

function responseError(response: Response, body: unknown): ApiError {
  if (
    response.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/problem+json")
  ) {
    return parseApiError(response.status, body, response.headers);
  }
  const correlationId = response.headers.get("X-Correlation-Id") ?? undefined;
  return {
    kind: "unexpectedResponse",
    status: response.status,
    ...(correlationId === undefined ? {} : { correlationId }),
  };
}

export function createHttpClient(config: HttpClientConfig): HttpClient {
  const fetchFn = config.fetchFn ?? fetch;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const clock = createServerClock();

  return {
    clock,
    async request<T>(options: RequestOptions): Promise<HttpResponse<T>> {
      const controller = new AbortController();
      const requestState = { timedOut: false };
      const timeout = setTimeout(() => {
        requestState.timedOut = true;
        controller.abort();
      }, timeoutMs);
      const abortFromCaller = () => {
        controller.abort();
      };
      options.signal?.addEventListener("abort", abortFromCaller, {
        once: true,
      });
      if (options.signal?.aborted) controller.abort();
      const requestStartMs = Date.now();

      try {
        const response = await fetchFn(
          requestUrl(config.baseUrl, options.path, options.query),
          {
            method: options.method,
            headers: headersFor(options),
            ...(options.body === undefined
              ? {}
              : { body: JSON.stringify(options.body) }),
            signal: controller.signal,
          },
        );
        clock.observe(response.headers.get("Date"), requestStartMs, Date.now());
        const meta = responseMeta(response);
        if (response.status === 204) return { data: undefined as T, meta };

        let body: unknown;
        try {
          body = await response.json();
        } catch {
          if (!response.ok) throwApiError(responseError(response, undefined));
          throwApiError({ kind: "unexpectedResponse", ...meta });
        }
        if (!response.ok) throwApiError(responseError(response, body));
        return { data: body as T, meta };
      } catch (error) {
        if (isApiError(error)) throwApiError(error);
        if (requestState.timedOut)
          throwApiError({ kind: "network", reason: "timeout" });
        if (options.signal?.aborted)
          throwApiError({ kind: "network", reason: "aborted" });
        throwApiError({ kind: "network", reason: "offline" });
      } finally {
        clearTimeout(timeout);
        options.signal?.removeEventListener("abort", abortFromCaller);
      }
    },
  };
}

function throwApiError(error: ApiError): never {
  // ApiError is deliberately a serializable discriminated union, not an Error class.
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw error;
}

function isApiError(error: unknown): error is ApiError {
  if (error === null || typeof error !== "object" || !("kind" in error))
    return false;
  return [
    "problem",
    "unknownProblem",
    "network",
    "unexpectedResponse",
  ].includes(String(error.kind));
}
