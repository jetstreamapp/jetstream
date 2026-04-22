import { z } from 'zod';

export const releaseTagSchema = z.enum(['web', 'desktop', 'extension', 'all']);
export type ReleaseTag = z.infer<typeof releaseTagSchema>;

export const releasePlatformSchema = z.enum(['web', 'desktop', 'extension']);
export type ReleasePlatform = z.infer<typeof releasePlatformSchema>;

export const releaseHighlightSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  platforms: z.array(releaseTagSchema).optional(),
  docLink: z.string().optional(),
});
export type ReleaseHighlight = z.infer<typeof releaseHighlightSchema>;

export const releaseCtaSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});
export type ReleaseCta = z.infer<typeof releaseCtaSchema>;

export const releaseVersionsSchema = z
  .object({
    web: z.string().optional(),
    desktop: z.string().optional(),
    extension: z.string().optional(),
  })
  .optional();
export type ReleaseVersions = z.infer<typeof releaseVersionsSchema>;

/**
 * Shape of the MDX frontmatter authored in apps/docs/release-notes/*.mdx.
 * The generator script reads this, validates it, and writes a JSON array of ReleaseNote.
 */
export const releaseNoteFrontmatterSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  date: z.string().min(1),
  authors: z.array(z.string()).optional(),
  tags: z.array(releaseTagSchema).min(1),
  versions: releaseVersionsSchema,
  summary: z.string().min(1),
  highlights: z.array(releaseHighlightSchema).min(1),
  cta: releaseCtaSchema.optional(),
});
export type ReleaseNoteFrontmatter = z.infer<typeof releaseNoteFrontmatterSchema>;

/**
 * A single release note, as consumed at runtime by the in-app popover.
 * Derived from the MDX frontmatter; `date` is normalized to ISO (YYYY-MM-DD).
 */
export const releaseNoteSchema = releaseNoteFrontmatterSchema.extend({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type ReleaseNote = z.infer<typeof releaseNoteSchema>;

export const releaseNotesArraySchema = z.array(releaseNoteSchema);
