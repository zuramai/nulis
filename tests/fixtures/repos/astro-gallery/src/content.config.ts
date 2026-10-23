import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { defineCollection } from "astro:content";

const photoMetadata = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  location: z.string().min(1),
  tags: z.array(z.string().trim().min(1)).min(1),
  camera_settings: z.object({
    camera: z.string(),
    aperture: z.number().positive(),
    iso: z.number().int().positive(),
    focal_length: z.number().positive(),
  }),
});
const gallery = defineCollection({
  schema: ({ image }) => photoMetadata.extend({ src: image() }),
  loader: glob({ base: "./src/photos", pattern: "**/*.{md,mdx}" }),
});
export type Photo = z.infer<typeof photoMetadata>;
export const collections = { gallery };
