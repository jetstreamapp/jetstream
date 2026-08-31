import { useEffect, useState } from 'react';

/**
 * Shared `debounceMs` for filter-result count announcements ("Showing X of Y ..."): the count changes
 * on every keystroke, so announce once after the value settles.
 */
export const FILTER_COUNT_ANNOUNCE_DEBOUNCE_MS = 600;

export interface AssistiveStatusProps {
  message: string;
  /**
   * Delay before a changed message is committed to the live region. Use for messages that update
   * per keystroke (filter result counts): screen readers drop polite live-region churn during
   * typing, so announce once after the value settles.
   */
  debounceMs?: number;
}

/**
 * Visually-hidden live region for announcing async state transitions (loading started/finished).
 *
 * Keep this MOUNTED across the whole transition and change only `message` — a live region that is
 * inserted into the DOM already containing its text (e.g. a spinner with baked-in "Loading"
 * assistive text) is unreliably announced, and an unmounting spinner announces nothing at all.
 */
export const AssistiveStatus = ({ message, debounceMs }: AssistiveStatusProps) => {
  const [displayedMessage, setDisplayedMessage] = useState(message);

  useEffect(() => {
    if (!debounceMs) {
      setDisplayedMessage(message);
      return;
    }
    const timeout = window.setTimeout(() => setDisplayedMessage(message), debounceMs);
    return () => window.clearTimeout(timeout);
  }, [message, debounceMs]);

  return (
    <span role="status" aria-live="polite" aria-atomic="true" className="slds-assistive-text">
      {displayedMessage}
    </span>
  );
};

export default AssistiveStatus;
