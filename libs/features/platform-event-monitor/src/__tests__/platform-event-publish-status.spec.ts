import { describe, expect, it } from 'vitest';
import { getPublishStatusMessage } from '../platform-event-monitor.utils';

describe('getPublishStatusMessage', () => {
  it('is empty before anything was published', () => {
    expect(getPublishStatusMessage(false, null)).toBe('');
  });

  it('reports progress while publishing, even over a previous response', () => {
    expect(getPublishStatusMessage(true, { success: true, eventId: 'e1' })).toBe('Publishing event');
  });

  it('reports the published event id', () => {
    expect(getPublishStatusMessage(false, { success: true, eventId: 'e1b2' })).toBe('Event published with id e1b2');
  });

  it('reports the failure reason', () => {
    expect(getPublishStatusMessage(false, { success: false, errorMessage: 'No access' })).toBe(
      'There was an error publishing your event: No access',
    );
  });

  // The visible notification reads "Event Id: <id>"; the E2E page object matches that text with getByText, which
  // fails in strict mode if the live region repeats it
  it('does not repeat the visible "Event Id:" text', () => {
    expect(getPublishStatusMessage(false, { success: true, eventId: 'e1b2' })).not.toMatch(/Event Id:/);
  });
});
