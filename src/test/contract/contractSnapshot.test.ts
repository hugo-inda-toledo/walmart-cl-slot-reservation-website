import { describe, expect, it } from "vitest";

import { loadContractSnapshot } from "./contractSnapshot";

describe("contract snapshot", () => {
  it("resolves and validates the listRegions success response", () => {
    const snapshot = loadContractSnapshot();
    const validate = snapshot.responseValidator(
      "/api/v1/regions",
      "get",
      "200",
    );

    expect(validate([{ code: "13", name: "Región Metropolitana" }])).toBe(true);
  });

  it("rejects an invalid listRegions response", () => {
    const snapshot = loadContractSnapshot();
    const validate = snapshot.responseValidator(
      "/api/v1/regions",
      "get",
      "200",
    );

    expect(validate([{ code: 13, name: "Región Metropolitana" }])).toBe(false);
    expect(validate.errors).toBeDefined();
  });

  it("follows a shared response reference for an error schema", () => {
    const snapshot = loadContractSnapshot();
    const validate = snapshot.responseValidator(
      "/api/v1/regions",
      "get",
      406,
      "application/problem+json",
    );

    expect(
      validate({
        type: "https://example.test/problems/not-acceptable",
        title: "No aceptable",
        status: 406,
        code: "NOT_ACCEPTABLE",
      }),
    ).toBe(true);
  });
});
