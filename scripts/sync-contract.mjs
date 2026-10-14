import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const canonicalSourceUrl = "http://localhost:8080/openapi/openapi.yml";
const defaultSource = process.env.CONTRACT_URL ?? canonicalSourceUrl;
const argumentsList = process.argv.slice(2);
const check = argumentsList.includes("--check");
const sourceIndex = argumentsList.indexOf("--from");
const source =
  sourceIndex === -1 ? defaultSource : argumentsList[sourceIndex + 1];

if (!source) {
  throw new Error("--from requiere una URL o ruta de contrato.");
}

const root = process.cwd();
const contractDirectory = resolve(root, "contract");
const contractPath = resolve(contractDirectory, "openapi.yml");
const sourcePath = resolve(contractDirectory, "source.json");

function isUrl(value) {
  return /^https?:\/\//u.test(value) || value.startsWith("file:");
}

function sourceUrlForMetadata(value) {
  return /^https?:\/\//u.test(value) ? value : canonicalSourceUrl;
}

async function readSource(value) {
  if (value.startsWith("file:")) {
    return readFile(fileURLToPath(value));
  }
  if (!isUrl(value)) {
    return readFile(resolve(root, value));
  }

  const response = await fetch(value);
  if (!response.ok) {
    throw new Error(
      `No se pudo descargar el contrato (${response.status} ${response.statusText}).`,
    );
  }
  return Buffer.from(await response.arrayBuffer());
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const sourceBytes = await readSource(source);
const sourceHash = sha256(sourceBytes);

if (check) {
  const snapshotBytes = await readFile(contractPath);
  if (sha256(snapshotBytes) !== sourceHash) {
    console.error(
      "El contrato fuente difiere de contract/openapi.yml. Ejecuta npm run contract:sync.",
    );
    process.exitCode = 1;
  }
} else {
  await mkdir(contractDirectory, { recursive: true });
  await writeFile(contractPath, sourceBytes);
  await writeFile(
    sourcePath,
    `${JSON.stringify(
      {
        sourceUrl: sourceUrlForMetadata(source),
        sha256: sourceHash,
        syncedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  );
}
