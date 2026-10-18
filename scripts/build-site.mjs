import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const BUILD = path.join(ROOT, "build");
const MANIFEST_PATH = path.join(BUILD, "manifest.json");
const STOCK_FILE = "notes/stock-picker-experiment/index.html";
const STOCK_ROUTE = "/notes/stock-picker-experiment.html";

function cacheClass(route) {
  if (route.endsWith(".html") || route.endsWith("/")) return "document";
  if (route.endsWith(".xml") || route.endsWith(".txt")) return "metadata";
  if (route.startsWith("/_astro/") || route.startsWith("/assets/birds/")) return "immutable";
  return "asset";
}

function attributeValue(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return match ? (match[1] ?? match[2]) : null;
}

function decodeHtmlAttribute(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([\da-f]+);/gi, (_, number) => String.fromCodePoint(Number.parseInt(number, 16)));
}

function metaRefreshLocation(html) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    if ((attributeValue(tag, "http-equiv") || "").toLowerCase() !== "refresh") continue;
    const content = attributeValue(tag, "content");
    const url = content?.match(/^\s*\d+(?:\.\d+)?\s*;\s*url\s*=\s*(.*?)\s*$/i)?.[1];
    if (!url) continue;
    const location = decodeHtmlAttribute(url.replace(/^(['"])(.*)\1$/, "$2"));
    if (!location || /[\r\n]/.test(location)) {
      throw new Error("Astro emitted an invalid meta-refresh redirect");
    }
    return location;
  }
  return null;
}

async function distFiles(directory = DIST, prefix = "") {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`Refusing symlink in dist: ${relative}`);
    if (entry.isDirectory()) files.push(...await distFiles(path.join(directory, entry.name), relative));
    else if (entry.isFile()) files.push(relative);
    else throw new Error(`Unsupported output in dist: ${relative}`);
  }
  return files;
}

function addFile(files, route, file) {
  const existing = files[route];
  if (existing && existing.file !== file) throw new Error(`Duplicate static route: ${route}`);
  files[route] = { file, cache: cacheClass(route) };
}

function addRedirect(redirects, files, route, location) {
  if (files[route]) delete files[route];
  const existing = redirects[route];
  if (existing && existing !== location) throw new Error(`Duplicate redirect route: ${route}`);
  redirects[route] = location;
}

async function main() {
  let outputFiles;
  try {
    outputFiles = await distFiles();
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error("Astro output directory dist/ is missing. Run `astro build` before this script.");
    }
    throw error;
  }
  if (outputFiles.length === 0) throw new Error("Astro output directory dist/ is empty.");

  const files = Object.create(null);
  const redirects = Object.create(null);
  for (const file of outputFiles) {
    const route = `/${file}`;
    if (file === STOCK_FILE) {
      addFile(files, STOCK_ROUTE, file);
      addRedirect(redirects, files, "/notes/stock-picker-experiment", STOCK_ROUTE);
      addRedirect(redirects, files, "/notes/stock-picker-experiment/", STOCK_ROUTE);
      addRedirect(redirects, files, `/${STOCK_FILE}`, STOCK_ROUTE);
      continue;
    }

    if (!file.endsWith("/index.html") && file !== "index.html") {
      addFile(files, route, file);
      continue;
    }

    const canonical = file === "index.html" ? "/" : `/${file.slice(0, -"index.html".length)}`;
    const html = await fs.readFile(path.join(DIST, ...file.split("/")), "utf8");
    const redirectTarget = metaRefreshLocation(html);
    if (redirectTarget) {
      addRedirect(redirects, files, canonical, redirectTarget);
      addRedirect(redirects, files, route, redirectTarget);
    } else {
      addFile(files, canonical, file);
      addFile(files, route, file);
    }
    if (canonical !== "/") addRedirect(redirects, files, canonical.slice(0, -1), canonical);
  }

  const manifest = { version: 1, files, redirects };
  await fs.mkdir(BUILD, { recursive: true });
  const temporary = `${MANIFEST_PATH}.${process.pid}.tmp`;
  await fs.writeFile(temporary, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(temporary, MANIFEST_PATH);
  console.log(`Wrote ${path.relative(ROOT, MANIFEST_PATH)} with ${Object.keys(files).length} files and ${Object.keys(redirects).length} redirects.`);
}

main().catch((error) => {
  console.error(`Unable to build static manifest: ${error.message}`);
  process.exitCode = 1;
});
