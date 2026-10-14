import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

test("the initial App exposes the Reservar horario heading", async () => {
  const source = await readFile(
    resolve(process.cwd(), "src/app/App.tsx"),
    "utf8",
  );

  assert.match(source, /<h1>Reservar horario<\/h1>/);
});
