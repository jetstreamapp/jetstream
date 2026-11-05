import { beforeEach, describe, expect, it } from 'vitest';
import { loadGoogleAnalyticsIfRequired } from '../useConditionalGoogleAnalytics';

function getDataLayerCommands(): unknown[][] {
  return (window.dataLayer ?? []) as unknown[][];
}

describe('loadGoogleAnalyticsIfRequired', () => {
  beforeEach(() => {
    window.dataLayer = undefined;
    window.gtag = undefined;
    document.head.querySelectorAll('script').forEach((script) => script.remove());
    window.history.replaceState({}, '', '/auth/password-reset/verify?email=a%40b.com&code=1234-secret');
  });

  it('configures GA without the default page view and sends a sanitized page view', () => {
    loadGoogleAnalyticsIfRequired('G-TEST');

    const commands = getDataLayerCommands();
    const configCommand = commands.find((command) => command[0] === 'config');
    expect(configCommand?.[1]).toBe('G-TEST');
    expect(configCommand?.[2]).toMatchObject({ send_page_view: false, page_path: '/auth/password-reset/verify' });

    const pageViewCommand = commands.find((command) => command[0] === 'event' && command[1] === 'page_view');
    expect(pageViewCommand?.[2]).toMatchObject({
      page_location: 'http://localhost:3000/auth/password-reset/verify',
      page_path: '/auth/password-reset/verify',
    });

    const serialized = JSON.stringify(commands);
    expect(serialized).not.toContain('1234-secret');
    expect(serialized).not.toContain('a%40b.com');
  });

  it('sends a sanitized page view on SPA navigation but not when only the query changes', () => {
    loadGoogleAnalyticsIfRequired('G-TEST');
    const pageViewsBefore = getDataLayerCommands().filter((command) => command[1] === 'page_view').length;

    window.history.replaceState({}, '', '/auth/password-reset/verify?error=Unknown');
    expect(getDataLayerCommands().filter((command) => command[1] === 'page_view')).toHaveLength(pageViewsBefore);

    window.history.pushState({}, '', '/app/teams/invite?teamId=1&token=invite-secret');
    const pageViews = getDataLayerCommands().filter((command) => command[1] === 'page_view');
    expect(pageViews).toHaveLength(pageViewsBefore + 1);
    expect(pageViews[pageViews.length - 1][2]).toMatchObject({ page_path: '/app/teams/invite' });
    expect(JSON.stringify(pageViews)).not.toContain('invite-secret');
  });
});
