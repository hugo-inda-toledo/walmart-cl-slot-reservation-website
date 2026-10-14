import {
  http,
  HttpResponse,
  type DefaultBodyType,
  type HttpHandler,
} from "msw";

import { endpoints } from "@/api/endpoints";

import { FIXTURES, type FixtureEntry } from "./fixtures";

export const handlers: readonly HttpHandler[] = endpoints.map((endpoint) => {
  const fixture = defaultFixture(endpoint.operationId);
  const path = endpoint.path.replace(/\{[^}]+\}/g, ":param");
  return http[endpoint.method.toLowerCase() as "get" | "post" | "delete"](
    path,
    () => responseFromFixture(fixture) as never,
  );
});

export function responseFromFixture(
  fixture: FixtureEntry,
): HttpResponse<DefaultBodyType> {
  if (fixture.status === 204) {
    return new HttpResponse(null, { status: fixture.status });
  }
  return HttpResponse.json(fixture.body as DefaultBodyType, {
    status: fixture.status,
    headers: { "content-type": fixture.contentType },
  });
}

function defaultFixture(operationId: string): FixtureEntry {
  const fixture = FIXTURES.find(
    (entry) =>
      entry.operationId === operationId &&
      entry.status >= 200 &&
      entry.status < 300,
  );
  if (!fixture)
    throw new Error(`No existe fixture exitosa para ${operationId}.`);
  return fixture;
}
