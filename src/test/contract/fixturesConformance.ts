import type { ErrorObject } from "ajv";

import { endpoints } from "@/api/endpoints";

import type { FixtureEntry } from "../msw/fixtures";
import { loadContractSnapshot } from "./contractSnapshot";
import { problemExtensions } from "./problemExtensions";

export interface FixtureValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const snapshot = loadContractSnapshot();

export function validateFixture(
  fixture: FixtureEntry,
): FixtureValidationResult {
  const endpoint = endpoints.find(
    (candidate) => candidate.operationId === fixture.operationId,
  );
  if (!endpoint) {
    return {
      valid: false,
      errors: [`operación desconocida: ${fixture.operationId}`],
    };
  }
  if (fixture.status === 204) {
    return fixture.body === undefined
      ? { valid: true, errors: [] }
      : { valid: false, errors: ["una respuesta 204 no puede tener cuerpo"] };
  }

  const validators = [
    snapshot.responseValidator(
      endpoint.path,
      endpoint.method,
      fixture.status,
      fixture.contentType,
    ),
    ...problemValidators(fixture),
  ];
  const errors: string[] = [];
  for (const validator of validators) {
    if (!validator(fixture.body)) {
      errors.push(...formatErrors(validator.errors));
    }
  }
  return { valid: errors.length === 0, errors };
}

function problemValidators(fixture: FixtureEntry) {
  if (fixture.contentType !== "application/problem+json") return [];
  const code = readCode(fixture.body);
  if (code === "SLOT_FULL") {
    return [snapshot.schemaValidator("ReservationSlotFullProblem")];
  }
  if (code === "ADDRESS_NOT_COVERED") {
    return [
      snapshot.schemaValidator(
        fixture.operationId === "resolveCoverage"
          ? "GeoAddressNotCoveredProblem"
          : "CatalogAddressNotCoveredProblem",
      ),
    ];
  }
  const extension = code ? problemExtensions[code] : undefined;
  if (!extension) return [];
  return [
    snapshot.schemaValidator("Problem"),
    snapshot.compileSchema(extension),
  ];
}

function readCode(body: unknown): string | undefined {
  if (body === null || typeof body !== "object") return undefined;
  const code = (body as Record<string, unknown>).code;
  return typeof code === "string" ? code : undefined;
}

function formatErrors(errors: ErrorObject[] | null | undefined): string[] {
  return (errors ?? []).map(
    (error) => `${error.instancePath || "/"} ${error.message ?? "inválido"}`,
  );
}
