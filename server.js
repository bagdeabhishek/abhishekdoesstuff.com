const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const STATUS_UPSTREAM = process.env.STATUS_UPSTREAM || "http://192.168.1.61:9109/status";
const ROOT = __dirname;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
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

const server = http.createServer((req, res) => {
  if (req.url === "/api/status" || req.url === "/api/status/") {
    proxyStatus(res);
    return;
  }
  serveFile(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`abhishekdoesstuff.com listening on :${PORT}`);
});
