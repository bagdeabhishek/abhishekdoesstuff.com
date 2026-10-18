import { getCollection, type CollectionEntry } from "astro:content";

export const SITE_ORIGIN = "https://abhishekdoesstuff.com";

export type MusingEntry = CollectionEntry<"musings">;

export interface MusingSummary {
  entry: MusingEntry;
  title: string;
  description: string;
  route: string;
  dateModified?: string;
}

export function cleanMusingBody(body: string): string {
  return body
    .replace(/^\s*#\s+[^\r\n]+\s*\r?\n/, "")
    .replace(/^_(?:AI-assisted|AI-generated)[^\r\n]*_\s*\r?\n?/im, "")
    .trim();
}

export function descriptionFromMusing(body: string): string {
  const summary =
    body.match(
      /^##\s+(?:Summary|TL;DR)\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/im,
    )?.[1] || body;

  return summary
    .replace(/^[-*]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`>#|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

export function displayExcerpt(value: string): string {
  if (value.length < 180) return value;
  const boundary = value.lastIndexOf(" ");
  return `${value.slice(0, boundary > 0 ? boundary : value.length)}…`;
}

export function dateModifiedFromMusing(body: string): string | undefined {
  return body.match(/^(?:Last updated|Completed):\s*([^\r\n]+)/im)?.[1];
}

export function musingRoute(entry: MusingEntry): string {
  return entry.data.permalink || `/musings/${entry.id}/`;
}

export function slugFromMusingRoute(route: string): string {
  const match = route.match(/^\/musings\/(.+)\/$/);
  if (!match) throw new Error(`Unsupported Musing permalink: ${route}`);
  return match[1];
}

export function summarizeMusing(entry: MusingEntry): MusingSummary {
  const cleanedBody = cleanMusingBody(entry.body ?? "");
  const title = entry.data.title || entry.id;
  return {
    entry,
    title,
    route: musingRoute(entry),
    description:
      descriptionFromMusing(cleanedBody) ||
      `An AI-assisted research musing about ${title}.`,
    dateModified: dateModifiedFromMusing(cleanedBody),
  };
}

export async function getPublishedMusingEntries(): Promise<MusingEntry[]> {
  return getCollection("musings", ({ data }) => data.published !== false);
}

export async function getMusingSummaries(): Promise<MusingSummary[]> {
  const entries = await getPublishedMusingEntries();
  return entries
    .filter((entry) => !entry.data.redirect_to)
    .map(summarizeMusing)
    .sort((a, b) =>
      (b.dateModified || "").localeCompare(a.dateModified || ""),
    );
}

export function articleSchema(summary: MusingSummary) {
  const canonical = new URL(summary.route, SITE_ORIGIN).href;
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: summary.title,
    name: summary.title,
    description: summary.description,
    url: canonical,
    inLanguage: "en-IN",
    author: {
      "@type": "Person",
      name: "Abhishek Bagade",
      url: `${SITE_ORIGIN}/`,
    },
    isPartOf: {
      "@type": "WebSite",
      name: "Abhishek Does Stuff",
      url: `${SITE_ORIGIN}/`,
    },
    ...(summary.dateModified
      ? { dateModified: summary.dateModified }
      : undefined),
  };
}

export function collectionSchema(description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    headline: "Musings",
    name: "Musings",
    description,
    url: `${SITE_ORIGIN}/musings/`,
    inLanguage: "en-IN",
    author: {
      "@type": "Person",
      name: "Abhishek Bagade",
      url: `${SITE_ORIGIN}/`,
    },
    isPartOf: {
      "@type": "WebSite",
      name: "Abhishek Does Stuff",
      url: `${SITE_ORIGIN}/`,
    },
  };
}
