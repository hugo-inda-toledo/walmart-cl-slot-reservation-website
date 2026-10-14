import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const workspaceFile = (path) => resolve(process.cwd(), path);

test("Compose del evaluador publica la web y configura el proxy hacia la API local", async () => {
  const compose = await readFile(workspaceFile("docker-compose.yml"), "utf8");
  const envExample = await readFile(workspaceFile(".env.example"), "utf8");

  assert.match(compose, /web:\s*[\s\S]*build: \./);
  assert.match(compose, /image: walmart-cl-slot-reservation-website:local/);
  assert.match(compose, /"\$\{WEB_PORT:-8081\}:8080"/);
  assert.match(
    compose,
    /API_UPSTREAM: \$\{API_UPSTREAM:-http:\/\/host\.docker\.internal:8080\}/,
  );
  assert.match(compose, /host\.docker\.internal:host-gateway/);
  assert.match(compose, /healthcheck:[\s\S]*127\.0\.0\.1:8080/);
  assert.match(envExample, /^WEB_PORT=8081$/m);
  assert.match(
    envExample,
    /^API_UPSTREAM=http:\/\/host\.docker\.internal:8080$/m,
  );
});

test("el smoke full-stack comprueba página, proxy y validación CORS", async () => {
  await access(workspaceFile("scripts/smoke-fullstack.sh"));
  const script = await readFile(
    workspaceFile("scripts/smoke-fullstack.sh"),
    "utf8",
  );

  assert.match(script, /Reservar horario/);
  assert.match(script, /\/api\/v1\/demo-addresses/);
  assert.match(script, /\/api\/v1\/slot-holds/);
  assert.match(script, /VALIDATION_ERROR/);
  assert.match(script, /CORS_REJECTED/);
});

test("el workflow E2E obtiene la API como checkout hermano y conserva diagnósticos", async () => {
  await access(workspaceFile(".github/workflows/e2e.yml"));
  const workflow = await readFile(
    workspaceFile(".github/workflows/e2e.yml"),
    "utf8",
  );

  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.match(workflow, /^\s*workflow_dispatch:\s*$/m);
  assert.match(
    workflow,
    /Configura la variable de repositorio API_REPOSITORY \(owner\/repo\) y, si es privado, el secreto API_REPO_TOKEN/,
  );
  assert.match(workflow, /vars\.API_REPOSITORY/);
  assert.match(workflow, /path: web/);
  assert.match(workflow, /path: api/);
  assert.match(workflow, /docker compose up --build -d --wait/);
  assert.match(workflow, /npm run e2e/);
  assert.match(workflow, /\.\/scripts\/smoke-fullstack\.sh/);
  assert.match(workflow, /playwright-report/);
  assert.match(workflow, /docker compose down -v/);
});
