import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import type { AnySchema, ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { parse } from "yaml";

type JsonObject = Record<string, unknown>;

export type ResponseValidator = ValidateFunction;

export interface ContractSnapshot {
  responseValidator(
    path: string,
    method: string,
    status: string | number,
    contentType?: string,
  ): ResponseValidator;
  schemaValidator(name: string): ResponseValidator;
  /** Compila un JSON Schema 2020-12 propio con el mismo Ajv del contrato. */
  compileSchema(schema: object): ResponseValidator;
}

function asObject(value: unknown, description: string): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`El contrato no contiene ${description}.`);
  }

  return value as JsonObject;
}

function resolveLocalReference(
  document: JsonObject,
  reference: string,
): unknown {
  if (!reference.startsWith("#/")) {
    throw new Error(`La referencia de contrato no es local: ${reference}`);
  }

  return reference
    .slice(2)
    .split("/")
    .reduce<unknown>((current, segment) => {
      const object = asObject(current, `la referencia ${reference}`);
      const value = object[segment.replaceAll("~1", "/").replaceAll("~0", "~")];

      if (value === undefined) {
        throw new Error(`No se encontró la referencia ${reference}.`);
      }

      return value;
    }, document);
}

function resolveResponse(document: JsonObject, response: unknown): JsonObject {
  const responseObject = asObject(response, "la respuesta de la operación");
  const reference = responseObject["$ref"];

  if (typeof reference === "string") {
    return resolveResponse(
      document,
      resolveLocalReference(document, reference),
    );
  }

  return responseObject;
}

function responseSchema(
  document: JsonObject,
  path: string,
  method: string,
  status: string | number,
  contentType: string,
): unknown {
  const statusCode = String(status);
  const paths = asObject(document.paths, "paths");
  const operation = asObject(paths[path], `el path ${path}`)[
    method.toLowerCase()
  ];
  const responses = asObject(
    asObject(operation, `la operación ${method.toUpperCase()} ${path}`)
      .responses,
    `las respuestas de ${method.toUpperCase()} ${path}`,
  );
  const response = resolveResponse(document, responses[statusCode]);
  const content = asObject(
    response.content,
    `el contenido de ${method.toUpperCase()} ${path}`,
  );
  const mediaType = asObject(
    content[contentType],
    `el content type ${contentType}`,
  );

  if (mediaType.schema === undefined) {
    throw new Error(
      `La respuesta ${statusCode} no define schema para ${contentType}.`,
    );
  }

  return mediaType.schema;
}

export function loadContractSnapshot(): ContractSnapshot {
  const contractPath = resolve(process.cwd(), "contract/openapi.yml");
  const document = asObject(
    parse(readFileSync(contractPath, "utf8")),
    "un documento YAML",
  );
  const ajv = new Ajv2020({ allErrors: true, strict: false });

  addFormats(ajv);
  for (const format of ["int32", "int64", "double"]) {
    ajv.addFormat(format, true);
  }
  ajv.addSchema(document, "openapi");

  return {
    responseValidator(path, method, status, contentType = "application/json") {
      const schema = responseSchema(
        document,
        path,
        method,
        status,
        contentType,
      );
      return ajv.compile(schemaForAjv(schema) as AnySchema);
    },
    compileSchema(schema) {
      return ajv.compile(schema as AnySchema);
    },
    schemaValidator(name) {
      return ajv.compile({
        $ref: `openapi#/components/schemas/${name}`,
      } as AnySchema);
    },
  };
}

function schemaForAjv(schema: unknown): unknown {
  const reference = asObject(schema, "el schema de respuesta")["$ref"];

  if (typeof reference === "string" && reference.startsWith("#/")) {
    return { $ref: `openapi${reference}` };
  }

  return schemaWithDocumentReferences(schema);
}

function schemaWithDocumentReferences(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(schemaWithDocumentReferences);
  }
  if (value === null || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as JsonObject).map(([key, nestedValue]) => [
      key,
      key === "$ref" &&
      typeof nestedValue === "string" &&
      nestedValue.startsWith("#/")
        ? `openapi${nestedValue}`
        : schemaWithDocumentReferences(nestedValue),
    ]),
  );
}
