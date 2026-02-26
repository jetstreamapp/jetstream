import { useObservable } from '@jetstream/shared/ui-utils';
import { InfoSuccessWarningError } from '@jetstream/types';
import React, { FunctionComponent, useEffect, useRef, useState } from 'react';
import { Subject } from 'rxjs';
import { Toast } from './Toast';

const appToastMessage = new Subject<AppToastMessage>();
const appToastMessage$ = appToastMessage.asObservable();

const DEFAULT_DURATION = 5000;

export interface AppToastMessage {
  type: InfoSuccessWarningError;
  message: string | React.ReactNode;
  duration?: number; // <= 0 to keep until user closes
}

export function fireToast(toast: AppToastMessage) {
  appToastMessage.next(toast);
}

export interface AppToastMessageWithId extends AppToastMessage {
  id: number;
}

export const AppToast: FunctionComponent = () => {
  const newMessage = useObservable(appToastMessage$);
  const [activeMessages, setActiveMessages] = useState<AppToastMessageWithId[]>([]);
  const nextIdRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      // Clear any remaining timers on unmount
      timersRef.current.forEach((timeout) => clearTimeout(timeout));
      timersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!newMessage) {
      return;
    }

    const id = nextIdRef.current++;
    const duration = newMessage.duration ?? DEFAULT_DURATION;

    setActiveMessages((messages) => [...messages, { id, ...newMessage }]);

    if (duration > 0) {
      const timeout = setTimeout(() => {
        setActiveMessages((messages) => messages.filter((m) => m.id !== id));
        timersRef.current.delete(id);
      }, duration);
      timersRef.current.set(id, timeout);
    }
  }, [newMessage]);

  return (
    <div data-testid="toast-notify-container" className="slds-notify_container">
      {activeMessages.slice(0, 3).map(({ id, message, type }) => (
        <Toast key={id} type={type} onClose={() => setActiveMessages((messages) => messages.filter((m) => m.id !== id))} showIcon>
          {message}
        </Toast>
      ))}
    </div>
  );
};
