import { css } from '@emotion/react';
import { useObservable } from '@jetstream/shared/ui-utils';
import { InfoSuccessWarningError } from '@jetstream/types';
import React, { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { Subject } from 'rxjs';
import { useAnnouncer } from '../widgets/useAnnouncer';
import { Toast } from './Toast';

const appToastMessage = new Subject<AppToastMessage>();
const appToastMessage$ = appToastMessage.asObservable();

const DEFAULT_DURATION = 5000;

export interface AppToastMessage {
  type: InfoSuccessWarningError;
  message: string | React.ReactNode;
  /** Auto-dismiss delay; <= 0 keeps the toast until the user closes it. Errors default to that. */
  duration?: number;
}

export function fireToast(toast: AppToastMessage) {
  appToastMessage.next(toast);
}

export interface AppToastMessageWithId extends AppToastMessage {
  id: number;
  /** Resolved auto-dismiss delay (see `AppToastMessage.duration`) */
  duration: number;
}

export const AppToast: FunctionComponent = () => {
  const newMessage = useObservable(appToastMessage$);
  const [activeMessages, setActiveMessages] = useState<AppToastMessageWithId[]>([]);
  const nextIdRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const { announce, announcer } = useAnnouncer();

  useEffect(() => {
    return () => {
      // Clear any remaining timers on unmount
      timersRef.current.forEach((timeout) => clearTimeout(timeout));
      timersRef.current.clear();
    };
  }, []);

  const startDismissTimer = useCallback((id: number, duration: number) => {
    if (duration <= 0 || timersRef.current.has(id)) {
      return;
    }
    const timeout = setTimeout(() => {
      setActiveMessages((messages) => messages.filter((message) => message.id !== id));
      timersRef.current.delete(id);
    }, duration);
    timersRef.current.set(id, timeout);
  }, []);

  // Auto-dismiss pauses while the pointer or keyboard focus is on the toasts (WCAG 2.2.1): a user
  // moving toward the close button, or reading with a magnifier, must not lose the message mid-way
  function pauseDismissTimers() {
    timersRef.current.forEach((timeout) => clearTimeout(timeout));
    timersRef.current.clear();
  }
  function resumeDismissTimers() {
    activeMessages.forEach(({ id, duration }) => startDismissTimer(id, duration));
  }

  useEffect(() => {
    if (!newMessage) {
      return;
    }

    const id = nextIdRef.current++;
    // Errors stay until dismissed: they are the toasts a user must be able to read and act on
    const duration = newMessage.duration ?? (newMessage.type === 'error' ? 0 : DEFAULT_DURATION);

    setActiveMessages((messages) => [...messages, { ...newMessage, id, duration }]);
    startDismissTimer(id, duration);

    // Non-error toasts are announced through ONE persistent polite region — a status region that
    // mounts already containing its text is skipped by most screen readers. Errors render as
    // role="alert", which IS announced on insertion, so they are not mirrored (that would double them).
    if (newMessage.type !== 'error' && typeof newMessage.message === 'string') {
      announce(newMessage.message);
    }
  }, [newMessage, startDismissTimer, announce]);

  return (
    <div
      data-testid="toast-notify-container"
      className="slds-notify_container"
      // The strip spans the whole viewport width but the toast boxes are centered: only the boxes may
      // catch the pointer, otherwise the transparent strip blocks header controls beneath it and its
      // hover pauses auto-dismiss while the pointer merely rests near the top of the page
      css={css`
        pointer-events: none;
        .slds-notify {
          pointer-events: auto;
        }
      `}
      onMouseEnter={pauseDismissTimers}
      onMouseLeave={resumeDismissTimers}
      onFocus={pauseDismissTimers}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          resumeDismissTimers();
        }
      }}
    >
      {announcer}
      {activeMessages.slice(0, 3).map(({ id, message, type }) => (
        <Toast
          key={id}
          type={type}
          liveRegion={type === 'error'}
          onClose={() => setActiveMessages((messages) => messages.filter((message) => message.id !== id))}
          showIcon
        >
          {message}
        </Toast>
      ))}
    </div>
  );
};
