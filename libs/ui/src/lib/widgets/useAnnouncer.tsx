import { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import AssistiveStatus from './AssistiveStatus';

export interface UseAnnouncerReturn {
  /** Announce a message to screen readers through the `announcer` element. */
  announce: (message: string) => void;
  /** Render this once anywhere in the component's output and keep it mounted across announcements. */
  announcer: ReactElement;
}

/**
 * Screen reader announcements for discrete action outcomes (row added, save failed, toggle applied).
 *
 * A live region only fires when its content CHANGES, so setting the same message twice in a row (two
 * identical failures, add-add-add) would be silent after the first. `announce` therefore clears the
 * region and re-sets the message a beat later ("clear-then-set") so every call announces. The pending
 * timeout is owned by the hook: a newer announcement cancels it, and unmount cleans it up, so callers
 * need no isMounted guard.
 */
export function useAnnouncer(): UseAnnouncerReturn {
  const [message, setMessage] = useState('');
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

  const announce = useCallback((newMessage: string) => {
    window.clearTimeout(timeoutRef.current);
    setMessage('');
    timeoutRef.current = window.setTimeout(() => setMessage(newMessage), 100);
  }, []);

  return { announce, announcer: <AssistiveStatus message={message} /> };
}

export default useAnnouncer;
