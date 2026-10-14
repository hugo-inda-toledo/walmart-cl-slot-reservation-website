import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

const workspaceFile = (path) => resolve(process.cwd(), path);

async function readWorkspaceFile(path) {
  return readFile(workspaceFile(path), "utf8");
}

function renderNginxTemplate(template, apiUpstream) {
  return template.replaceAll("${API_UPSTREAM}", apiUpstream);
}

test("container serves the SPA and proxies API calls as same-origin requests", async () => {
  const template = await readWorkspaceFile("nginx/default.conf.template");
  const rendered = renderNginxTemplate(template, "http://api.internal:8080");

  assert.match(rendered, /listen 8080/);
  assert.match(
    rendered,
    /location \/api\/\s*\{[\s\S]*proxy_pass http:\/\/api\.internal:8080;/,
  );
  assert.match(
    rendered,
    /proxy_set_header X-Correlation-Id \$http_x_correlation_id;/,
  );
  assert.match(rendered, /proxy_set_header Origin "";/);
  assert.match(
    rendered,
    /location \/\s*\{[\s\S]*try_files \$uri \/index\.html;/,
  );
  assert.match(
    rendered,
    /location \/assets\/\s*\{[\s\S]*Cache-Control "public, max-age=31536000, immutable"/,
  );
  assert.match(
    rendered,
    /location = \/index\.html\s*\{[\s\S]*Cache-Control "no-store"/,
  );
  assert.match(
    rendered,
    /Content-Security-Policy "default-src 'self'; connect-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'"/,
  );
  assert.match(rendered, /X-Content-Type-Options "nosniff"/);
  assert.match(rendered, /Referrer-Policy "no-referrer"/);
});

test("cache locations keep security headers for index, SPA fallback, and assets", async () => {
  const template = await readWorkspaceFile("nginx/default.conf.template");
  const expectedHeaders = [
    "add_header Content-Security-Policy \"default-src 'self'; connect-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'\" always;",
    'add_header X-Content-Type-Options "nosniff" always;',
    'add_header Referrer-Policy "no-referrer" always;',
  ];

  for (const location of ["location = /index.html", "location /assets/"]) {
    const locationStart = template.indexOf(location);
    const locationEnd = template.indexOf("\n    }", locationStart);
    const locationBlock = template.slice(locationStart, locationEnd);

    assert.notEqual(locationStart, -1, `${location} must be configured`);
    for (const header of expectedHeaders) {
      assert.ok(
        locationBlock.includes(header),
        `${location} must keep ${header} when it sets Cache-Control`,
      );
    }
  }
});

test("container image uses the prescribed classic-builder-compatible stages", async () => {
  const dockerfile = await readWorkspaceFile("Dockerfile");
  const dockerignore = await readWorkspaceFile(".dockerignore");

  assert.match(dockerfile, /FROM node:24\.21\.0-alpine AS build/);
  assert.match(dockerfile, /RUN npm ci/);
  assert.match(dockerfile, /RUN npm run build/);
  assert.match(dockerfile, /FROM nginxinc\/nginx-unprivileged:1\.30\.5-alpine/);
  assert.match(
    dockerfile,
    /ENV API_UPSTREAM=http:\/\/host\.docker\.internal:8080/,
  );
  assert.match(dockerfile, /EXPOSE 8080/);
  assert.match(
    dockerfile,
    /HEALTHCHECK[\s\S]*CMD[\s\S]*wget[\s\S]*http:\/\/localhost:8080\//,
  );
  assert.doesNotMatch(
    dockerfile,
    /RUN\s+--mount|COPY\s+--(?:chmod|link)|<<EOF|TARGETARCH|TARGETPLATFORM|#\s*syntax=/,
  );
  assert.deepEqual(dockerignore.trim().split("\n"), [
    "node_modules/",
    "dist/",
    "coverage/",
    "playwright-report/",
    "test-results/",
    ".git/",
    ".env",
  ]);
});

test("CI verifies the web autonomously and lints every workflow with pinned tooling", async () => {
  const packageJson = JSON.parse(await readWorkspaceFile("package.json"));
  const workflow = await readWorkspaceFile(".github/workflows/ci.yml");

  assert.equal(
    packageJson.scripts.verify,
    "npm run lint && npm run typecheck && npm run test:coverage && npm run build",
  );
  assert.match(workflow, /^on:\n  push:\n  pull_request:/m);
  assert.match(
    workflow,
    /actions\/checkout@11bd71901bbe5b1630ceea73d27597364c9af683/,
  );
  assert.match(workflow, /actions\/setup-node@[a-f0-9]{40}/);
  assert.match(workflow, /node-version-file: ".nvmrc"/);
  assert.match(workflow, /cache: npm/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm run verify/);
  assert.match(workflow, /run: npm audit --audit-level=high/);
  assert.match(workflow, /run: docker build \./);
  assert.match(workflow, /workflow-lint:/);
  assert.match(
    workflow,
    /rhysd\/actionlint@sha256:887a259a5a534f3c4f36cb02dca341673c6089431057242cdc931e9f133147e9/,
  );
  assert.match(workflow, /\.github\/workflows\/\*\.yml/);
  assert.doesNotMatch(workflow, /\.\.\//);
});
