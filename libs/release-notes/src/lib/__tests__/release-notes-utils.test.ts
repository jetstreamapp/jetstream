import { describe, expect, it } from 'vitest';
import { ReleaseNote } from '../release-notes.types';
import { getLatestDate, getUnseenCount, getVisibleReleases } from '../release-notes-utils';

const releases: ReleaseNote[] = [
  {
    slug: 'v9.14.0',
    title: '9.14.0',
    date: '2026-04-19',
    tags: ['web', 'desktop'],
    summary: 'Web + desktop release',
    highlights: [
      { title: 'Profile popover', platforms: ['web', 'desktop'] },
      { title: 'Security headers', platforms: ['web'] },
    ],
  },
  {
    slug: 'v2.22.0-ext',
    title: 'Extension 2.22.0',
    date: '2026-04-10',
    tags: ['extension'],
    summary: 'Extension-only release',
    highlights: [{ title: 'Extension asset path fix' }],
  },
  {
    slug: 'v9.13.0',
    title: '9.13.0',
    date: '2026-04-05',
    tags: ['all'],
    summary: 'Applies to everywhere',
    highlights: [{ title: 'Platform-agnostic feature' }],
  },
];

describe('release-notes-utils', () => {
  describe('getVisibleReleases', () => {
    it('filters releases by platform tag', () => {
      const result = getVisibleReleases(releases, 'web');
      expect(result.map(({ slug }) => slug)).toEqual(['v9.14.0', 'v9.13.0']);
    });

    it('includes releases tagged "all" for any platform', () => {
      const result = getVisibleReleases(releases, 'extension');
      expect(result.map(({ slug }) => slug)).toEqual(['v2.22.0-ext', 'v9.13.0']);
    });

    it('drops highlights filtered by per-highlight platforms override', () => {
      const result = getVisibleReleases(releases, 'desktop');
      const desktopRelease = result.find(({ slug }) => slug === 'v9.14.0');
      expect(desktopRelease?.highlights.map(({ title }) => title)).toEqual(['Profile popover']);
    });

    it('drops releases whose highlights all filter out', () => {
      const noHighlightsForDesktop: ReleaseNote[] = [
        {
          slug: 'v1.0.0',
          title: 'v1',
          date: '2026-01-01',
          tags: ['web', 'desktop'],
          summary: 'mixed',
          highlights: [{ title: 'Web only', platforms: ['web'] }],
        },
      ];
      expect(getVisibleReleases(noHighlightsForDesktop, 'desktop')).toEqual([]);
    });

    it('sorts newest first', () => {
      const result = getVisibleReleases(releases, 'web');
      expect(result[0].date > result[1].date).toBe(true);
    });

    it('filters to releases strictly newer than sinceDate', () => {
      const result = getVisibleReleases(releases, 'web', '2026-04-05');
      expect(result.map(({ slug }) => slug)).toEqual(['v9.14.0']);
    });
  });

  describe('getLatestDate', () => {
    it('returns the newest date for a platform', () => {
      expect(getLatestDate(releases, 'web')).toBe('2026-04-19');
      expect(getLatestDate(releases, 'extension')).toBe('2026-04-10');
    });

    it('returns null when no releases match', () => {
      expect(getLatestDate([], 'web')).toBeNull();
    });
  });

  describe('getUnseenCount', () => {
    it('counts all releases when watermark is null', () => {
      expect(getUnseenCount(releases, 'web', null)).toBe(2);
    });

    it('counts only releases newer than watermark', () => {
      expect(getUnseenCount(releases, 'web', '2026-04-05')).toBe(1);
    });

    it('returns zero when watermark matches newest date', () => {
      expect(getUnseenCount(releases, 'web', '2026-04-19')).toBe(0);
    });
  });
});
