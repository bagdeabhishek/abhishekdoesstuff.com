const http = require("http");
const fs = require("fs");
const path = require("path");
const { buildMusings } = require("./musings");
const birdArt = require("./data/bird-art.json");

const PORT = Number(process.env.PORT || 3000);
const STATUS_UPSTREAM = process.env.STATUS_UPSTREAM || "http://192.168.1.61:9109/status";
const BIRDNET_UPSTREAM = process.env.BIRDNET_UPSTREAM || "http://192.168.1.110:8080";
const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID || process.env.GOOGLE_ANALYTICS_ID || "";
const ROOT = __dirname;
const STATUS_TIMEOUT_MS = 3000;
const STATUS_MAX_BYTES = 16 * 1024;
const BIRDNET_TIMEOUT_MS = 5000;
const BIRDNET_MAX_BYTES = 512 * 1024;
const BIRDNET_SSE_MAX_EVENT_BYTES = 64 * 1024;
const birdArtByScientificName = new Map(birdArt.map((entry) => [entry.scientific_name, entry]));

const CACHE = {
  document: "public, max-age=0, must-revalidate",
  metadata: "public, max-age=3600, must-revalidate",
  asset: "public, max-age=3600, stale-while-revalidate=86400",
};

// The application source lives beside the static files in Nixpacks deployments.
// Only these explicit routes are public; adding a file to the repo never exposes it.
const PUBLIC_FILES = new Map([
  ["/", { file: "index.html", cache: CACHE.document }],
  ["/index.html", { file: "index.html", cache: CACHE.document }],
  ["/styles.css", { file: "styles.css", cache: CACHE.document }],
  ["/status.js", { file: "status.js", cache: CACHE.asset }],
  ["/birds/", { file: path.join("birds", "index.html"), cache: CACHE.document }],
  ["/birds/index.html", { file: path.join("birds", "index.html"), cache: CACHE.document }],
  ["/birds.css", { file: "birds.css", cache: CACHE.document }],
  ["/birds.js", { file: "birds.js", cache: CACHE.asset }],
  ["/debabufy", { file: path.join("debabufy", "index.html"), cache: CACHE.document }],
  ["/debabufy/", { file: path.join("debabufy", "index.html"), cache: CACHE.document }],
  ["/debabufy/index.html", { file: path.join("debabufy", "index.html"), cache: CACHE.document }],
  ["/robots.txt", { file: "robots.txt", cache: CACHE.metadata }],
  ["/sitemap.xml", { file: "sitemap.xml", cache: CACHE.metadata }],
  ["/humans.txt", { file: "humans.txt", cache: CACHE.metadata }],
  ["/og.png", { file: "og.png", cache: CACHE.asset }],
  ["/og.svg", { file: "og.svg", cache: CACHE.asset }],
  ["/logo.jpg", { file: "logo.jpg", cache: CACHE.asset }],
  ["/logo-transparent.png", { file: "logo-transparent.png", cache: CACHE.asset }],
  ["/logo-512.webp", { file: "logo-512.webp", cache: CACHE.asset }],
  ["/favicon.ico", { file: "favicon.ico", cache: CACHE.asset }],
  ["/favicon-48.png", { file: "favicon-48.png", cache: CACHE.asset }],
  ["/favicon-192.png", { file: "favicon-192.png", cache: CACHE.asset }],
  ["/apple-touch-icon.png", { file: "apple-touch-icon.png", cache: CACHE.asset }],
  [
    "/assets/projects/ambilight.webp",
    { file: path.join("assets", "projects", "ambilight.webp"), cache: CACHE.asset },
  ],
  [
    "/assets/projects/edifier-repair.webp",
    { file: path.join("assets", "projects", "edifier-repair.webp"), cache: CACHE.asset },
  ],
  [
    "/assets/projects/jarrarium.webp",
    { file: path.join("assets", "projects", "jarrarium.webp"), cache: CACHE.asset },
  ],
  [
    "/assets/projects/twitter-network.webp",
    { file: path.join("assets", "projects", "twitter-network.webp"), cache: CACHE.asset },
  ],
  [
    "/assets/projects/debabufy-mark.png",
    { file: path.join("assets", "projects", "debabufy-mark.png"), cache: CACHE.asset },
  ],
  [
    "/notes/stock-picker-experiment.html",
    { file: path.join("notes", "stock-picker-experiment.html"), cache: CACHE.document },
  ],
]);

for (const entry of birdArt) {
  PUBLIC_FILES.set(entry.image, {
    file: entry.image.replace(/^\//, ""),
    cache: "public, max-age=31536000, immutable",
  });
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".ico": "image/x-icon",
};

const SECURITY_HEADERS = {
  "content-security-policy": [
    "default-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: https://commons.wikimedia.org https://upload.wikimedia.org",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "script-src 'self' https://www.googletagmanager.com",
    "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com",
    "manifest-src 'self'",
  ].join("; "),
  "cross-origin-opener-policy": "same-origin",
  "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=31536000",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-xss-protection": "0",
};

class StatusProxyError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

class BirdsProxyError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

function send(req, res, status, headers, body = "") {
  const responseBody = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  const responseHeaders = { ...SECURITY_HEADERS, ...headers };

  if (status !== 204 && status !== 304 && responseHeaders["content-length"] === undefined) {
    responseHeaders["content-length"] = String(responseBody.length);
  }

  res.writeHead(status, responseHeaders);
  if (req.method === "HEAD" || status === 204 || status === 304) {
    res.end();
    return;
  }
  res.end(responseBody);
}

function sendTextError(req, res, status, message, extraHeaders = {}) {
  send(req, res, status, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
    ...extraHeaders,
  }, message);
}

function requestUrl(req) {
  if (typeof req.url !== "string" || !req.url.startsWith("/") || req.url.startsWith("//")) {
    return null;
  }
  try {
    const url = new URL(req.url, "http://localhost");
    return url.origin === "http://localhost" ? url : null;
  } catch {
    return null;
  }
}

function requestPathname(url) {
  try {
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.includes("\0") || pathname.includes("\\")) return null;
    return pathname;
  } catch {
    return null;
  }
}

function fileEtag(stat) {
  return `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
}

function isNotModified(req, stat, etag) {
  const ifNoneMatch = req.headers["if-none-match"];
  if (ifNoneMatch) {
    return ifNoneMatch.split(",").some((candidate) => {
      const value = candidate.trim();
      return value === "*" || value === etag;
    });
  }

  const ifModifiedSince = req.headers["if-modified-since"];
  if (!ifModifiedSince) return false;
  const since = Date.parse(ifModifiedSince);
  if (!Number.isFinite(since)) return false;
  return Math.floor(stat.mtimeMs / 1000) * 1000 <= since;
}

function serveFile(req, res, pathname) {
  const publicFile = PUBLIC_FILES.get(pathname);
  if (!publicFile) {
    sendTextError(req, res, 404, "Not found");
    return;
  }

  const filePath = path.join(ROOT, publicFile.file);
  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      sendTextError(req, res, 404, "Not found");
      return;
    }

    const etag = fileEtag(stat);
    const commonHeaders = {
      "cache-control": publicFile.cache,
      etag,
      "last-modified": stat.mtime.toUTCString(),
    };

    if (isNotModified(req, stat, etag)) {
      send(req, res, 304, commonHeaders);
      return;
    }

    fs.readFile(filePath, (readError, data) => {
      if (readError) {
        sendTextError(req, res, 404, "Not found");
        return;
      }
      send(req, res, 200, {
        ...commonHeaders,
        "content-type": TYPES[path.extname(filePath)] || "application/octet-stream",
      }, data);
    });
  });
}

function serveMusing(req, res, pathname, musings) {
  const page = musings.pages.get(pathname);
  if (!page) return false;
  if (page.redirect) {
    send(req, res, 301, { location: page.redirect, "cache-control": CACHE.metadata });
  } else {
    send(req, res, 200, { "content-type": TYPES[".html"], "cache-control": CACHE.document }, page.html);
  }
  return true;
}

function upstreamUrl() {
  let url;
  try {
    url = new URL(STATUS_UPSTREAM);
  } catch {
    throw new StatusProxyError("invalid_upstream_url");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new StatusProxyError("invalid_upstream_url");
  }
  return url;
}

async function readJsonBody(response) {
  const contentType = response.headers.get("content-type") || "";
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json" && !mediaType.endsWith("+json")) {
    if (response.body) await response.body.cancel().catch(() => {});
    throw new StatusProxyError("invalid_content_type");
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength) || Number(contentLength) > STATUS_MAX_BYTES) {
      if (response.body) await response.body.cancel().catch(() => {});
      throw new StatusProxyError("response_too_large");
    }
  }
  if (!response.body) throw new StatusProxyError("empty_response");

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > STATUS_MAX_BYTES) {
      await reader.cancel().catch(() => {});
      throw new StatusProxyError("response_too_large");
    }
    chunks.push(Buffer.from(value));
  }

  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, total));
  } catch {
    throw new StatusProxyError("invalid_utf8");
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new StatusProxyError("invalid_json");
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new StatusProxyError("invalid_schema");
  }
  return payload;
}

function requiredLabel(payload, key, pattern, maxLength) {
  const value = payload[key];
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength || !pattern.test(value)) {
    throw new StatusProxyError("invalid_schema");
  }
  if (/\b(?:\d{1,3}\.){3}\d{1,3}\b/.test(value)) {
    throw new StatusProxyError("invalid_schema");
  }
  return value;
}

function requiredNumber(payload, key, min, max, integer = false) {
  const value = payload[key];
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new StatusProxyError("invalid_schema");
  }
  return value;
}

function optionalNumber(payload, key, min, max) {
  if (payload[key] === null || payload[key] === undefined) return undefined;
  return requiredNumber(payload, key, min, max);
}

function publicStatus(payload) {
  const updatedAt = payload.updated_at;
  const timestamp = typeof updatedAt === "string" && updatedAt.length <= 40 ? Date.parse(updatedAt) : NaN;
  if (!Number.isFinite(timestamp)) throw new StatusProxyError("invalid_schema");

  const result = {
    host: requiredLabel(payload, "host", /^[A-Za-z0-9][A-Za-z0-9_-]*$/, 64),
    location: requiredLabel(payload, "location", /^[A-Za-z0-9][A-Za-z0-9 .,()'-]*$/, 80),
    uptime_seconds: requiredNumber(payload, "uptime_seconds", 0, Number.MAX_SAFE_INTEGER, true),
    load_1m: requiredNumber(payload, "load_1m", 0, 100000),
  };

  const memory = optionalNumber(payload, "memory_used_pct", 0, 100);
  const disk = optionalNumber(payload, "disk_used_pct", 0, 100);
  const temperature = optionalNumber(payload, "cpu_temp_c", -50, 150);
  if (memory !== undefined) result.memory_used_pct = memory;
  if (disk !== undefined) result.disk_used_pct = disk;
  if (temperature !== undefined) result.cpu_temp_c = temperature;
  result.updated_at = new Date(timestamp).toISOString();
  return result;
}

async function proxyStatus(req, res) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);

  try {
    const upstream = await fetch(upstreamUrl(), {
      cache: "no-store",
      headers: { accept: "application/json" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!upstream.ok) {
      if (upstream.body) await upstream.body.cancel().catch(() => {});
      throw new StatusProxyError("upstream_http_error");
    }

    const payload = publicStatus(await readJsonBody(upstream));
    send(req, res, 200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    }, `${JSON.stringify(payload)}\n`);
  } catch (error) {
    const timedOut = controller.signal.aborted;
    const code = timedOut ? "upstream_timeout" : error instanceof StatusProxyError ? error.code : "upstream_unreachable";
    console.warn(JSON.stringify({ event: "status_proxy_error", code }));
    send(req, res, timedOut ? 504 : 502, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    }, `${JSON.stringify({ error: timedOut ? "status_upstream_timeout" : "status_upstream_unavailable" })}\n`);
  } finally {
    clearTimeout(timeout);
  }
}

function birdnetUrl(pathname) {
  let base;
  try {
    base = new URL(BIRDNET_UPSTREAM);
  } catch {
    throw new BirdsProxyError("invalid_upstream_url");
  }
  if (base.protocol !== "http:" && base.protocol !== "https:") {
    throw new BirdsProxyError("invalid_upstream_url");
  }
  base.pathname = pathname;
  base.search = "";
  base.hash = "";
  return base;
}

async function readBirdnetJson(response) {
  const contentType = response.headers.get("content-type") || "";
  const mediaType = contentType.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json" && !mediaType.endsWith("+json")) {
    if (response.body) await response.body.cancel().catch(() => {});
    throw new BirdsProxyError("invalid_content_type");
  }

  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || Number(contentLength) > BIRDNET_MAX_BYTES)) {
    if (response.body) await response.body.cancel().catch(() => {});
    throw new BirdsProxyError("response_too_large");
  }
  if (!response.body) throw new BirdsProxyError("empty_response");

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > BIRDNET_MAX_BYTES) {
      await reader.cancel().catch(() => {});
      throw new BirdsProxyError("response_too_large");
    }
    chunks.push(Buffer.from(value));
  }

  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, total));
    return JSON.parse(text);
  } catch {
    throw new BirdsProxyError("invalid_json");
  }
}

function safeBirdLabel(value, maxLength = 100) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > maxLength ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new BirdsProxyError("invalid_schema");
  }
  return value;
}

function safeBirdNumber(value, min, max, integer = false) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new BirdsProxyError("invalid_schema");
  }
  return value;
}

function safeBirdTimestamp(value) {
  if (value === "" || value === null || value === undefined) return null;
  if (typeof value !== "string" || value.length > 40 || !Number.isFinite(Date.parse(value))) {
    throw new BirdsProxyError("invalid_schema");
  }
  return value;
}

function publicBirdSummary(payload) {
  if (!Array.isArray(payload) || payload.length > 1000) {
    throw new BirdsProxyError("invalid_schema");
  }

  const visible = new Map();
  let oneOffsFiltered = 0;
  let withoutArtworkFiltered = 0;

  for (const row of payload) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new BirdsProxyError("invalid_schema");
    }

    const scientificName = safeBirdLabel(row.scientific_name, 120);
    const commonName = safeBirdLabel(row.common_name, 120);
    const count = safeBirdNumber(row.count, 0, Number.MAX_SAFE_INTEGER, true);
    const firstHeard = safeBirdTimestamp(row.first_heard);
    const lastHeard = safeBirdTimestamp(row.last_heard);
    const avgConfidence = safeBirdNumber(row.avg_confidence, 0, 1);
    const maxConfidence = safeBirdNumber(row.max_confidence, 0, 1);
    const art = birdArtByScientificName.get(scientificName);

    if (count < 2) {
      oneOffsFiltered += 1;
      continue;
    }
    if (!art) {
      withoutArtworkFiltered += 1;
      continue;
    }

    const speciesCode = typeof row.species_code === "string" && row.species_code.length <= 40
      ? row.species_code
      : "";
    const item = {
      scientific_name: scientificName,
      common_name: commonName || art.common_name,
      species_code: speciesCode,
      count,
      first_heard: firstHeard,
      last_heard: lastHeard,
      avg_confidence: avgConfidence,
      max_confidence: maxConfidence,
      image: art.image,
      artwork: art.artwork,
    };

    const current = visible.get(scientificName);
    if (!current || item.count > current.count) visible.set(scientificName, item);
  }

  const species = Array.from(visible.values()).sort((a, b) => a.count - b.count || a.common_name.localeCompare(b.common_name));
  const timestamps = species.map((item) => item.last_heard).filter(Boolean).sort();
  return {
    generated_at: new Date().toISOString(),
    minimum_occurrences: 2,
    species_count: species.length,
    total_detections: species.reduce((sum, item) => sum + item.count, 0),
    one_offs_filtered: oneOffsFiltered,
    without_artwork_filtered: withoutArtworkFiltered,
    last_detection_at: timestamps.at(-1) || null,
    species,
  };
}

async function proxyBirdSummary(req, res) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BIRDNET_TIMEOUT_MS);

  try {
    const upstream = await fetch(birdnetUrl("/api/v2/analytics/species/summary"), {
      cache: "no-store",
      headers: { accept: "application/json" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!upstream.ok) {
      if (upstream.body) await upstream.body.cancel().catch(() => {});
      throw new BirdsProxyError("upstream_http_error");
    }

    const payload = publicBirdSummary(await readBirdnetJson(upstream));
    send(req, res, 200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    }, `${JSON.stringify(payload)}\n`);
  } catch (error) {
    const timedOut = controller.signal.aborted;
    const code = timedOut ? "upstream_timeout" : error instanceof BirdsProxyError ? error.code : "upstream_unreachable";
    console.warn(JSON.stringify({ event: "birds_proxy_error", code }));
    send(req, res, timedOut ? 504 : 502, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    }, `${JSON.stringify({ error: timedOut ? "birdnet_upstream_timeout" : "birdnet_upstream_unavailable" })}\n`);
  } finally {
    clearTimeout(timeout);
  }
}

function publicBirdDetection(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  try {
    const scientificName = safeBirdLabel(payload.scientificName, 120);
    const art = birdArtByScientificName.get(scientificName);
    if (!art) return null;
    const commonName = safeBirdLabel(payload.commonName, 120);
    const confidence = safeBirdNumber(payload.confidence, 0, 1);
    const date = safeBirdLabel(payload.date, 10);
    const time = safeBirdLabel(payload.time, 8);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}:\d{2}$/.test(time)) return null;
    const timestamp = payload.timestamp === undefined ? null : safeBirdTimestamp(payload.timestamp);
    return {
      scientific_name: scientificName,
      common_name: commonName,
      species_code: typeof payload.speciesCode === "string" && payload.speciesCode.length <= 40 ? payload.speciesCode : "",
      confidence,
      detected_at: timestamp,
      date,
      time,
    };
  } catch {
    return null;
  }
}

function writeSseEvent(res, event, payload) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function handleBirdnetSseBlock(res, block) {
  let event = "message";
  const data = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (event !== "detection" || data.length === 0) return;
  try {
    const detection = publicBirdDetection(JSON.parse(data.join("\n")));
    if (detection) writeSseEvent(res, "detection", detection);
  } catch {
    // Ignore malformed upstream events without exposing their contents.
  }
}

async function proxyBirdStream(req, res) {
  if (req.method === "HEAD") {
    send(req, res, 204, { "cache-control": "no-store" });
    return;
  }

  const controller = new AbortController();
  const connectionTimeout = setTimeout(() => controller.abort(), BIRDNET_TIMEOUT_MS);
  let headersSent = false;
  const abortUpstream = () => controller.abort();
  res.once("close", abortUpstream);

  try {
    const upstream = await fetch(birdnetUrl("/api/v2/detections/stream"), {
      cache: "no-store",
      headers: { accept: "text/event-stream" },
      redirect: "error",
      signal: controller.signal,
    });
    clearTimeout(connectionTimeout);
    if (!upstream.ok || !upstream.body) {
      if (upstream.body) await upstream.body.cancel().catch(() => {});
      throw new BirdsProxyError("upstream_stream_error");
    }
    const contentType = upstream.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("text/event-stream")) {
      await upstream.body.cancel().catch(() => {});
      throw new BirdsProxyError("invalid_content_type");
    }

    res.writeHead(200, {
      ...SECURITY_HEADERS,
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-store",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    headersSent = true;
    writeSseEvent(res, "ready", { connected: true });

    const heartbeat = setInterval(() => {
      if (!res.destroyed) res.write(": keep-alive\n\n");
    }, 20000);
    let buffer = "";
    const decoder = new TextDecoder("utf-8", { fatal: true });
    try {
      for await (const chunk of upstream.body) {
        buffer += decoder.decode(chunk, { stream: true });
        buffer = buffer.replace(/\r\n/g, "\n");
        let boundary;
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          handleBirdnetSseBlock(res, block);
        }
        if (Buffer.byteLength(buffer) > BIRDNET_SSE_MAX_EVENT_BYTES) {
          throw new BirdsProxyError("stream_event_too_large");
        }
      }
      if (!res.destroyed) res.end();
    } finally {
      clearInterval(heartbeat);
    }
  } catch (error) {
    if (controller.signal.aborted && res.destroyed) return;
    const timedOut = controller.signal.aborted && !headersSent;
    const code = timedOut ? "upstream_timeout" : error instanceof BirdsProxyError ? error.code : "upstream_unreachable";
    console.warn(JSON.stringify({ event: "birds_stream_proxy_error", code }));
    if (headersSent) {
      if (!res.destroyed) {
        writeSseEvent(res, "upstream-error", { error: "birdnet_stream_unavailable" });
        res.end();
      }
    } else {
      send(req, res, timedOut ? 504 : 502, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      }, `${JSON.stringify({ error: timedOut ? "birdnet_upstream_timeout" : "birdnet_upstream_unavailable" })}\n`);
    }
  } finally {
    clearTimeout(connectionTimeout);
    res.off("close", abortUpstream);
  }
}

function serveAnalytics(req, res) {
  const id = GA_MEASUREMENT_ID.trim();
  const enabled = /^G-[A-Z0-9]+$/i.test(id);
  const body = enabled
    ? `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config",${JSON.stringify(id.toUpperCase())},{anonymize_ip:true});(function(){var s=document.createElement("script");s.async=true;s.src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id.toUpperCase())}";document.head.appendChild(s);})();\n`
    : "// Google Analytics disabled: set GA_MEASUREMENT_ID=G-XXXXXXXXXX in Coolify.\n";

  send(req, res, 200, {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "no-store",
  }, body);
}

async function start() {
const musings = await buildMusings(ROOT);
const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    sendTextError(req, res, 405, "Method not allowed", { allow: "GET, HEAD" });
    return;
  }

  const url = requestUrl(req);
  if (!url) {
    sendTextError(req, res, 400, "Bad request");
    return;
  }

  const pathname = requestPathname(url);
  if (pathname === null) {
    sendTextError(req, res, 400, "Bad request");
    return;
  }

  if (pathname === "/api/status" || pathname === "/api/status/") {
    proxyStatus(req, res);
    return;
  }
  if (pathname === "/api/birds" || pathname === "/api/birds/") {
    proxyBirdSummary(req, res);
    return;
  }
  if (pathname === "/api/birds/stream") {
    proxyBirdStream(req, res);
    return;
  }
  if (pathname === "/analytics.js") {
    serveAnalytics(req, res);
    return;
  }
  if (pathname === "/musings") {
    send(req, res, 301, { location: "/musings/", "cache-control": CACHE.metadata });
    return;
  }
  if (pathname === "/birds") {
    send(req, res, 301, { location: "/birds/", "cache-control": CACHE.metadata });
    return;
  }
  if (/^\/musings\/[^/]+$/.test(pathname)) {
    send(req, res, 301, { location: `${pathname}/`, "cache-control": CACHE.metadata });
    return;
  }
  if (serveMusing(req, res, pathname, musings)) return;
  serveFile(req, res, pathname);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`abhishekdoesstuff.com listening on :${PORT}`);
});
}

start().catch((error) => {
  console.error("Unable to build Markdown Musings", error);
  process.exitCode = 1;
});
