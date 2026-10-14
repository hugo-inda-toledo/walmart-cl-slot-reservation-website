import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const repositoryRoot = process.cwd();
const canonicalContractUrl = "http://localhost:8080/openapi/openapi.yml";

describe("sync-contract", () => {
  it("keeps portable metadata when synchronizing and checking a local contract", async () => {
    const workspace = await mkdtemp(resolve(tmpdir(), "contract-sync-"));
    const scriptDirectory = resolve(workspace, "scripts");
    const contractDirectory = resolve(workspace, "contract");
    const sourcePath = resolve(workspace, "upstream-openapi.yml");
    const scriptPath = resolve(scriptDirectory, "sync-contract.mjs");
    const sourceBytes = await readFile(
      resolve(repositoryRoot, "contract/openapi.yml"),
    );

    await Promise.all([
      mkdir(scriptDirectory),
      mkdir(contractDirectory),
      writeFile(sourcePath, sourceBytes),
      writeFile(
        scriptPath,
        await readFile(resolve(repositoryRoot, "scripts/sync-contract.mjs")),
      ),
    ]);

    await execFileAsync(process.execPath, [scriptPath, "--from", sourcePath], {
      cwd: workspace,
    });

    const metadataPath = resolve(contractDirectory, "source.json");
    const metadataBeforeCheck = await readFile(metadataPath, "utf8");

    expect(JSON.parse(metadataBeforeCheck)).toMatchObject({
      sourceUrl: canonicalContractUrl,
      sha256: createHash("sha256").update(sourceBytes).digest("hex"),
    });

    await execFileAsync(
      process.execPath,
      [scriptPath, "--check", "--from", sourcePath],
      { cwd: workspace },
    );

    await expect(readFile(metadataPath, "utf8")).resolves.toBe(
      metadataBeforeCheck,
    );
  });
});
