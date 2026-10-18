import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const musings = defineCollection({
  loader: glob({
    base: "./content/musings",
    pattern: "**/index.md",
    generateId: ({ entry }) => entry.replace(/(?:^|\/)index\.md$/, ""),
  }),
  schema: z.object({
    layout: z.string().optional(),
    title: z.string().optional(),
    permalink: z.string().regex(/^\/musings\/.+\/$/).optional(),
    published: z.boolean().default(true),
    redirect_to: z.string().min(1).optional(),
  }),
});

export const collections = { musings };
