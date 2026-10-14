import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const eslint = new ESLint({ overrideConfigFile: "eslint.config.js" });

async function lint(source: string, filePath: string) {
  return eslint.lintText(source, { filePath });
}

async function expectRestrictedImport(source: string, filePath: string) {
  const [result] = await lint(source, filePath);

  expect(
    result?.messages.some(
      (message) => message.ruleId === "no-restricted-imports",
    ),
  ).toBe(true);
}

describe("layering rules", () => {
  it("prevents shared from importing api", async () => {
    await expectRestrictedImport(
      'import { client } from "@/api/apiClient";',
      "src/shared/x.ts",
    );
  });

  it("prevents api from importing features", async () => {
    await expectRestrictedImport(
      'import { address } from "@/features/address/model/address";',
      "src/api/x.ts",
    );
  });

  it("prevents a feature from importing another feature", async () => {
    await expectRestrictedImport(
      'import { address } from "@/features/address/model/address";',
      "src/features/slots/x.ts",
    );
  });

  it("prevents feature components from importing api values", async () => {
    await expectRestrictedImport(
      'import { catalogApi } from "@/api/catalogApi";',
      "src/features/slots/components/x.tsx",
    );
  });

  it("allows feature components to import api types", async () => {
    const [result] = await lint(
      'import type { CatalogApi } from "@/api/catalogApi"; declare const api: CatalogApi; declare function consumeApi(value: CatalogApi): void; consumeApi(api);',
      "src/features/slots/components/x.tsx",
    );

    expect(result?.messages).toEqual([]);
  });
});
