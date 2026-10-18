import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

const TEST_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_ROOT = path.resolve(process.env.SERVER_ROOT || TEST_ROOT);
const VALID_STATUS = {
  host: "makerbox",
  location: "Bengaluru lab",
  uptime_seconds: 86401,
  load_1m: 0.42,
  memory_used_pct: 61.5,
  disk_used_pct: 27,
  cpu_temp_c: 48.25,
  updated_at: "2026-10-18T09:10:11+00:00",
  lan_ip: "192.168.1.61",
  username: "private-user",
  processes: ["secret-daemon"],
};
const VALID_BIRD = {
  scientific_name: "Prinia socialis",
  common_name: "Ashy Prinia",
  species_code: "ashpri1",
  count: 3,
  first_heard: "2026-10-17T08:00:00Z",
  last_heard: "2026-10-18T08:00:00Z",
  avg_confidence: 0.72,
  max_confidence: 0.94,
  recording_path: "/private/recordings/secret.wav",
};

let upstream;
let app;
let origin;
let statusMode = "valid";
let birdMode = "valid";
let redirectedRequests = 0;
let streamRequests = 0;
let appLogs = "";

function listen(server, port = 0) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}

function close(server) {
  if (!server?.listening) return Promise.resolve();
  return new Promise((resolve) => server.close(resolve));
}

async function unusedPort() {
  const reservation = net.createServer();
  const port = await listen(reservation);
  await close(reservation);
  return port;
}

function json(res, value, status = 200) {
  const body = `${JSON.stringify(value)}\n`;
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function birdRows() {
  return [
    VALID_BIRD,
    { ...VALID_BIRD, count: 1, species_code: "oneoff" },
    {
      ...VALID_BIRD,
      scientific_name: "Private bird without artwork",
      common_name: "Unknown Bird",
      count: 8,
      recording_path: "/private/unknown.wav",
    },
  ];
}

function serveSse(res) {
  res.writeHead(200, { "content-type": "text/event-stream" });
  const valid = {
    scientificName: "Prinia socialis",
    commonName: "Ashy Prinia",
    speciesCode: "ashpri1",
    confidence: 0.91,
    timestamp: "2026-10-18T08:01:02Z",
    date: "2026-10-18",
    time: "08:01:02",
    recordingPath: "/private/stream-secret.wav",
  };
  const unknown = { ...valid, scientificName: "Unknown private bird", commonName: "Secret Bird" };
  res.write(`event: detection\ndata: ${JSON.stringify(valid)}\n\n`);
  res.write(`event: detection\ndata: ${JSON.stringify(unknown)}\n\n`);
  res.write("event: detection\ndata: {private malformed payload\n\n");
  res.end("event: debug\ndata: internal-only\n\n");
}

function upstreamHandler(req, res) {
  if (req.url === "/status") {
    if (statusMode === "timeout") return;
    if (statusMode === "redirect") {
      res.writeHead(302, { location: "/redirected-status" });
      res.end("private redirect body");
      return;
    }
    if (statusMode === "malformed") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"private":"secret-status"');
      return;
    }
    json(res, VALID_STATUS);
    return;
  }

  if (req.url === "/redirected-status" || req.url === "/redirected-birds") {
    redirectedRequests += 1;
    json(res, req.url.includes("status") ? VALID_STATUS : birdRows());
    return;
  }

  if (req.url === "/api/v2/analytics/species/summary") {
    if (birdMode === "redirect") {
      res.writeHead(307, { location: "/redirected-birds" });
      res.end("private redirect body");
      return;
    }
    if (birdMode === "wrong-content") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("secret-birdnet-error");
      return;
    }
    json(res, birdRows());
    return;
  }

  if (req.url === "/api/v2/detections/stream") {
    streamRequests += 1;
    serveSse(res);
    return;
  }

  res.writeHead(404);
  res.end();
}

async function waitForApp(child, timeoutMs = 8_000) {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`server did not become ready; output:\n${appLogs}`)), timeoutMs);
    const onData = (chunk) => {
      appLogs += chunk;
      if (appLogs.includes("listening on")) {
        clearTimeout(timeout);
        child.off("exit", onExit);
        resolve();
      }
    };
    const onExit = (code, signal) => {
      clearTimeout(timeout);
      reject(new Error(`server exited before readiness (${code ?? signal}); output:\n${appLogs}`));
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", (chunk) => { appLogs += chunk; });
    child.once("exit", onExit);
  });
}

async function stopApp(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const exited = await new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 2_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve(true);
    });
  });
  if (!exited) child.kill("SIGKILL");
}

async function request(pathname, options = {}) {
  return fetch(`${origin}${pathname}`, { redirect: "manual", signal: AbortSignal.timeout(7_000), ...options });
}

function rawRequest(pathname, method = "GET") {
  const url = new URL(origin);
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: url.hostname, port: url.port, method, path: pathname }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({
        status: res.statusCode,
        headers: res.headers,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    req.setTimeout(7_000, () => req.destroy(new Error("request timeout")));
    req.once("error", reject);
    req.end();
  });
}

before(async () => {
  upstream = http.createServer(upstreamHandler);
  const upstreamPort = await listen(upstream);
  const port = await unusedPort();
  origin = `http://127.0.0.1:${port}`;
  app = spawn(process.execPath, ["server.js"], {
    cwd: SERVER_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      STATUS_UPSTREAM: `http://127.0.0.1:${upstreamPort}/status`,
      BIRDNET_UPSTREAM: `http://127.0.0.1:${upstreamPort}`,
      GA_MEASUREMENT_ID: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await waitForApp(app);
});

after(async () => {
  await stopApp(app);
  await close(upstream);
});

test("status proxy exposes only its validated public schema", async () => {
  statusMode = "valid";
  const response = await request("/api/status");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("content-type"), /^application\/json/);
  assert.deepEqual(await response.json(), {
    host: "makerbox",
    location: "Bengaluru lab",
    uptime_seconds: 86401,
    load_1m: 0.42,
    memory_used_pct: 61.5,
    disk_used_pct: 27,
    cpu_temp_c: 48.25,
    updated_at: "2026-10-18T09:10:11.000Z",
  });
});

test("status proxy sanitizes malformed responses and refuses redirects", async () => {
  statusMode = "malformed";
  let response = await request("/api/status");
  assert.equal(response.status, 502);
  assert.equal(await response.text(), '{"error":"status_upstream_unavailable"}\n');

  redirectedRequests = 0;
  statusMode = "redirect";
  response = await request("/api/status");
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "status_upstream_unavailable" });
  assert.equal(redirectedRequests, 0, "the proxy must not follow the upstream redirect");
});

test("status proxy has a bounded upstream timeout", { timeout: 6_000 }, async () => {
  statusMode = "timeout";
  const started = Date.now();
  const response = await request("/api/status");
  const elapsed = Date.now() - started;
  assert.equal(response.status, 504);
  assert.deepEqual(await response.json(), { error: "status_upstream_timeout" });
  assert.ok(elapsed >= 2_500 && elapsed < 5_000, `expected roughly three seconds, got ${elapsed}ms`);
});

test("bird summary filters species and drops upstream-only fields", async () => {
  birdMode = "valid";
  const response = await request("/api/birds");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.minimum_occurrences, 2);
  assert.equal(body.species_count, 1);
  assert.equal(body.total_detections, 3);
  assert.equal(body.one_offs_filtered, 1);
  assert.equal(body.without_artwork_filtered, 1);
  assert.equal(body.last_detection_at, VALID_BIRD.last_heard);
  assert.ok(Number.isFinite(Date.parse(body.generated_at)));
  assert.deepEqual(Object.keys(body.species[0]), [
    "scientific_name", "common_name", "species_code", "count", "first_heard", "last_heard",
    "avg_confidence", "max_confidence", "image", "artwork",
  ]);
  assert.equal(body.species[0].scientific_name, VALID_BIRD.scientific_name);
  assert.equal(body.species[0].image, "/assets/birds/prinia-socialis.png");
  assert.equal(body.species[0].artwork.license, "CC BY-SA 3.0");
  assert.doesNotMatch(JSON.stringify(body), /private|recordings|Unknown Bird/);
});

test("bird summary sanitizes wrong content and refuses redirects", async () => {
  birdMode = "wrong-content";
  let response = await request("/api/birds");
  assert.equal(response.status, 502);
  assert.equal(await response.text(), '{"error":"birdnet_upstream_unavailable"}\n');

  redirectedRequests = 0;
  birdMode = "redirect";
  response = await request("/api/birds");
  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: "birdnet_upstream_unavailable" });
  assert.equal(redirectedRequests, 0, "the proxy must not follow the upstream redirect");
});

test("bird SSE sends ready and only sanitized, recognized detections", async () => {
  const response = await request("/api/birds/stream");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/event-stream/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = await response.text();
  assert.match(body, /event: ready\ndata: \{"connected":true\}/);
  assert.match(body, /event: detection\ndata: \{"scientific_name":"Prinia socialis"/);
  assert.equal((body.match(/event: detection/g) || []).length, 1);
  assert.doesNotMatch(body, /stream-secret|recordingPath|Unknown private bird|internal-only|malformed/);

  const requestsBeforeHead = streamRequests;
  const head = await request("/api/birds/stream", { method: "HEAD" });
  assert.equal(head.status, 204);
  assert.equal(await head.text(), "");
  assert.equal(streamRequests, requestsBeforeHead, "HEAD should complete without opening an upstream stream");
});

test("unsupported methods and malformed paths fail safely", async () => {
  const method = await request("/api/status", { method: "POST", body: "private-body" });
  assert.equal(method.status, 405);
  assert.equal(method.headers.get("allow"), "GET, HEAD");
  assert.equal(await method.text(), "Method not allowed");

  for (const pathname of ["//example.com/server.js", "/bad%ZZ", "/bad%5Cpath", "/%00"]) {
    const response = await rawRequest(pathname);
    assert.equal(response.status, 400, pathname);
    assert.equal(response.body, "Bad request", pathname);
  }
  for (const pathname of ["/../server.js", "/..%2Fserver.js", "/%2e%2e/server.js"]) {
    const response = await rawRequest(pathname);
    assert.equal(response.status, 404, pathname);
    assert.equal(response.body, "Not found", pathname);
  }
});

test("source, configuration, build metadata, and data stay private", async () => {
  const privatePaths = [
    "/server.js", "/package.json", "/package-lock.json", "/astro.config.mjs", "/.env",
    "/build/manifest.json", "/data/bird-art.json", "/src/pages/index.astro",
    "/content/musings/backrooms-creepypasta/index.md", "/tests/server-regression.mjs",
  ];
  for (const pathname of privatePaths) {
    const response = await request(pathname);
    assert.equal(response.status, 404, pathname);
    assert.equal(await response.text(), "Not found", pathname);
  }
});

test("static aliases, redirects, HEAD, and conditional requests remain stable", async () => {
  const home = await request("/");
  assert.equal(home.status, 200);
  assert.match(home.headers.get("content-type"), /^text\/html/);
  assert.equal(home.headers.get("cache-control"), "public, max-age=0, must-revalidate");
  assert.equal(home.headers.get("x-content-type-options"), "nosniff");
  const homeBody = await home.text();
  const index = await request("/index.html");
  assert.equal(index.status, 200);
  assert.equal(await index.text(), homeBody);

  for (const [from, to] of [
    ["/birds", "/birds/"],
    ["/movie-character-llm-experiment", "/movie-character-llm-experiment/"],
    ["/musings", "/musings/"],
    ["/notes/stock-picker-experiment", "/notes/stock-picker-experiment.html"],
    ["/notes/stock-picker-experiment/", "/notes/stock-picker-experiment.html"],
  ]) {
    const response = await request(from);
    assert.equal(response.status, 301, from);
    assert.equal(response.headers.get("location"), to, from);
  }

  const birds = await request("/birds/");
  const birdsIndex = await request("/birds/index.html");
  assert.equal(birds.status, 200);
  assert.equal(birdsIndex.status, 200);
  assert.equal(await birdsIndex.text(), await birds.text());
  assert.equal((await request("/notes/stock-picker-experiment.html")).status, 200);
  assert.equal((await request("/assets/theme.js")).status, 200);

  const asset = await request("/status.js");
  assert.equal(asset.status, 200);
  const assetBody = await asset.text();
  const etag = asset.headers.get("etag");
  assert.ok(etag);
  const head = await request("/status.js", { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  assert.equal(head.headers.get("etag"), etag);
  assert.equal(Number(head.headers.get("content-length")), Buffer.byteLength(assetBody));
  const conditional = await request("/status.js", { headers: { "if-none-match": etag } });
  assert.equal(conditional.status, 304);
  assert.equal(await conditional.text(), "");
});
