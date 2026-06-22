import { ReleaseNote } from '@jetstream/release-notes';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HeaderWhatsNewPopover } from '../HeaderWhatsNewPopover';

const LS_KEY = 'whats_new_last_seen_date';

const releases: ReleaseNote[] = [
  {
    slug: 'v9.14.0',
    title: '9.14.0',
    date: '2026-04-19',
    tags: ['web', 'desktop'],
    summary: 'Web + desktop release',
    highlights: [{ title: 'Popover' }],
  },
  {
    slug: 'v2.22.0',
    title: 'Extension 2.22.0',
    date: '2026-04-10',
    tags: ['extension'],
    summary: 'Extension-only',
    highlights: [{ title: 'Extension fix' }],
  },
];

describe('HeaderWhatsNewPopover', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('renders the badge when the watermark is unset', () => {
    render(<HeaderWhatsNewPopover platform="web" releases={releases} />);
    expect(screen.getByTestId('whats-new-badge')).toBeTruthy();
    expect(screen.getByRole('button', { name: /unread/i })).toBeTruthy();
  });

  it('hides the badge when the watermark is at-or-past the newest release', () => {
    localStorage.setItem(LS_KEY, '2026-04-19');
    render(<HeaderWhatsNewPopover platform="web" releases={releases} />);
    expect(screen.queryByTestId('whats-new-badge')).toBeNull();
  });

  it('shows the badge when the watermark is older than the newest release', () => {
    localStorage.setItem(LS_KEY, '2026-01-01');
    render(<HeaderWhatsNewPopover platform="web" releases={releases} />);
    expect(screen.getByTestId('whats-new-badge')).toBeTruthy();
  });

  it('returns null when no releases match the platform', () => {
    const { container } = render(<HeaderWhatsNewPopover platform="extension" releases={[releases[0]]} />);
    expect(container.firstChild).toBeNull();
  });

  it('aria-label reflects unread count', () => {
    render(<HeaderWhatsNewPopover platform="extension" releases={releases} />);
    expect(screen.getByRole('button', { name: /What's new.*1 unread/i })).toBeTruthy();
  });
});
