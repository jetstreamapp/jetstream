import { ReleaseHighlight, ReleaseNote, ReleasePlatform, ReleaseTag } from './release-notes.types';

function platformMatches(tags: ReleaseTag[] | undefined, platform: ReleasePlatform): boolean {
  if (!tags || tags.length === 0) {
    return true;
  }
  return tags.includes('all') || tags.includes(platform);
}

function filterHighlightsByPlatform(highlights: ReleaseHighlight[], platform: ReleasePlatform): ReleaseHighlight[] {
  return highlights.filter((highlight) => platformMatches(highlight.platforms, platform));
}

/**
 * Returns the releases visible to a given platform, sorted newest first.
 * A release is retained if its `tags` include the platform (or `all`).
 * Highlight-level `platforms` overrides further filter individual bullets;
 * a release with zero surviving highlights is dropped.
 *
 * @param sinceDate Optional ISO date string (YYYY-MM-DD). If provided, only releases strictly newer are returned.
 */
export function getVisibleReleases(
  notes: ReleaseNote[],
  platform: ReleasePlatform,
  sinceDate?: string | null,
): ReleaseNote[] {
  const result: ReleaseNote[] = [];
  for (const note of notes) {
    if (!platformMatches(note.tags, platform)) {
      continue;
    }
    if (sinceDate && note.date <= sinceDate) {
      continue;
    }
    const highlights = filterHighlightsByPlatform(note.highlights, platform);
    if (highlights.length === 0) {
      continue;
    }
    result.push({ ...note, highlights });
  }
  return result.sort((releaseA, releaseB) => (releaseA.date < releaseB.date ? 1 : releaseA.date > releaseB.date ? -1 : 0));
}

/**
 * Returns the ISO date of the most-recent release visible to the given platform,
 * or null when there are no eligible releases.
 */
export function getLatestDate(notes: ReleaseNote[], platform: ReleasePlatform): string | null {
  const visible = getVisibleReleases(notes, platform);
  return visible[0]?.date ?? null;
}

/**
 * Count of unseen releases for a given platform, relative to the watermark date.
 * When watermark is null/undefined, every eligible release counts as unseen.
 */
export function getUnseenCount(notes: ReleaseNote[], platform: ReleasePlatform, watermarkDate: string | null | undefined): number {
  return getVisibleReleases(notes, platform, watermarkDate ?? null).length;
}
