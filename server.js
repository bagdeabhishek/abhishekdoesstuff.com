const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const STATUS_UPSTREAM = process.env.STATUS_UPSTREAM || "http://192.168.1.61:9109/status";
const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID || process.env.GOOGLE_ANALYTICS_ID || "";
const ROOT = __dirname;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".ico": "image/x-icon",
};

function send(res, status, headers, body) {
  res.writeHead(status, headers);
  res.end(body);
}

function serveFile(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") pathname = "/index.html";

  const filePath = path.normalize(path.join(ROOT, pathname));
  if (!filePath.startsWith(ROOT)) {
    send(res, 403, { "content-type": "text/plain" }, "Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, { "content-type": "text/plain" }, "Not found");
      return;
    }
    send(res, 200, {
      "content-type": TYPES[path.extname(filePath)] || "application/octet-stream",
      "cache-control": pathname === "/index.html" ? "no-cache" : "public, max-age=300",
    }, data);
  });
}

async function proxyStatus(res) {
  try {
    const upstream = await fetch(STATUS_UPSTREAM, { cache: "no-store" });
    const body = await upstream.text();
    send(res, upstream.status, {
      "content-type": upstream.headers.get("content-type") || "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    }, body);
  } catch (error) {
    send(res, 502, {
      "content-type": "application/json",
      "cache-control": "no-store",
    }, JSON.stringify({ error: "status_upstream_unreachable" }));
  }
}

function serveAnalytics(res) {
  const id = GA_MEASUREMENT_ID.trim();
  const enabled = /^G-[A-Z0-9]+$/i.test(id);
  const body = enabled
    ? `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag("js",new Date());gtag("config",${JSON.stringify(id.toUpperCase())},{anonymize_ip:true});(function(){var s=document.createElement("script");s.async=true;s.src="https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id.toUpperCase())}";document.head.appendChild(s);})();\n`
    : "// Google Analytics disabled: set GA_MEASUREMENT_ID=G-XXXXXXXXXX in Coolify.\n";

  send(res, 200, {
    "content-type": "application/javascript; charset=utf-8",
    "cache-control": "no-store",
  }, body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/api/status" || url.pathname === "/api/status/") {
    proxyStatus(res);
    return;
  }
  if (url.pathname === "/analytics.js") {
    serveAnalytics(res);
    return;
  }
  serveFile(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`abhishekdoesstuff.com listening on :${PORT}`);
});
