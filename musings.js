const fs = require("fs");
const path = require("path");

const SITE = "https://abhishekdoesstuff.com";

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function frontMatter(source) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { data: {}, body: source };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, body: source.slice(match[0].length) };
}

function cleanBody(body, title) {
  return body
    .replace(/^\s*#\s+[^\r\n]+\s*\r?\n/, "")
    .replace(/^_(?:AI-assisted|AI-generated)[^\r\n]*_\s*\r?\n?/im, "")
    .trim();
}

function descriptionFrom(body) {
  const summary = body.match(/^##\s+(?:Summary|TL;DR)\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/im)?.[1] || body;
  return summary
    .replace(/^[-*]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function shell({ title, description, canonicalPath, body, type = "Article", dateModified }) {
  const canonical = `${SITE}${canonicalPath}`;
  const schema = {
    "@context": "https://schema.org",
    "@type": type,
    headline: title,
    name: title,
    description,
    url: canonical,
    inLanguage: "en-IN",
    author: { "@type": "Person", name: "Abhishek Bagade", url: `${SITE}/` },
    isPartOf: { "@type": "WebSite", name: "Abhishek Does Stuff", url: `${SITE}/` },
  };
  if (dateModified) schema.dateModified = dateModified;

  const medicalNote = /retina|retinal/i.test(title)
    ? " This page is general information, not medical diagnosis. Sudden flashes, new floaters, or a curtain over vision require urgent professional assessment."
    : "";

  return `<!doctype html>
<html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} — Abhishek Does Stuff</title>
<meta name="description" content="${escapeHtml(description)}"><meta name="author" content="Abhishek Bagade"><meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${canonical}"><link rel="icon" href="/favicon.ico" sizes="any"><link rel="stylesheet" href="/styles.css?v=20260713-5">
<meta property="og:type" content="article"><meta property="og:site_name" content="Abhishek Does Stuff"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/og.png">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${SITE}/og.png">
<script type="application/ld+json">${JSON.stringify(schema).replaceAll("<", "\\u003c")}</script></head>
<body><a class="skip-link" href="#main-content">Skip to content</a><div class="page-grid" aria-hidden="true"></div>
<header class="site-header"><a class="brand" href="/"><span class="brand-badge" aria-hidden="true">A//</span><span class="brand-copy"><strong>Abhishek Does Stuff</strong><small>project workbench · Bengaluru</small></span></a><nav aria-label="Primary navigation"><a href="/#builds">builds</a><a href="/musings/" aria-current="page">musings</a><a href="/#field-notes">field notes</a><a href="https://abagade.com/">writing ↗</a></nav></header>
<main id="main-content" class="article-shell musing-shell"><p class="article-back"><a href="/musings/">← All Musings</a></p><article><header class="article-header"><p class="section-kicker">Musing</p><h1>${escapeHtml(title)}</h1><p class="article-deck">${escapeHtml(description)}</p></header><aside class="ai-note"><strong>Note</strong><p>AI-assisted research note. Verify important claims with primary sources.${medicalNote}</p></aside><div class="prose">${body}</div></article></main>
<footer><div><strong>Abhishek Bagade</strong><span>ML platforms · maker projects · Bengaluru</span></div><div class="footer-links"><a href="/">Projects</a><a href="/musings/">Musings</a><a href="https://abagade.com/">Writing</a></div></footer><script src="/analytics.js" defer></script></body></html>`;
}

async function buildMusings(root) {
  const { marked } = await import("marked");
  marked.use({ gfm: true, breaks: false });
  const sourceRoot = path.join(root, "content", "musings");
  const pages = new Map();
  const articles = [];

  for (const entry of fs.readdirSync(sourceRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const sourcePath = path.join(sourceRoot, entry.name, "index.md");
    if (!fs.existsSync(sourcePath)) continue;
    const { data, body } = frontMatter(fs.readFileSync(sourcePath, "utf8"));
    if (data.published === "false") continue;
    const route = data.permalink || `/musings/${entry.name}/`;
    if (data.redirect_to) {
      pages.set(route, { redirect: data.redirect_to });
      continue;
    }
    const title = data.title || entry.name;
    const cleaned = cleanBody(body, title);
    const description = descriptionFrom(cleaned) || `An AI-assisted research musing about ${title}.`;
    const dateModified = cleaned.match(/^(?:Last updated|Completed):\s*([^\r\n]+)/im)?.[1];
    const html = shell({ title, description, canonicalPath: route, body: marked.parse(cleaned), dateModified });
    pages.set(route, { html });
    articles.push({ title, description, route, dateModified });
  }

  articles.sort((a, b) => (b.dateModified || "").localeCompare(a.dateModified || ""));
  const cards = articles.map((article) => `<li><a href="${article.route}"><strong>${escapeHtml(article.title)}</strong><span>${escapeHtml(article.description)}</span></a></li>`).join("");
  const indexBody = `<p>Notes on GenAI, CAD, hardware, media, and other practical questions.</p><ul class="musing-list">${cards}</ul>`;
  pages.set("/musings/", { html: shell({ title: "Musings", description: "AI-assisted research notes on GenAI, CAD, hardware, media, and other practical questions.", canonicalPath: "/musings/", body: indexBody, type: "CollectionPage" }) });
  return { pages, articles };
}

module.exports = { buildMusings };
