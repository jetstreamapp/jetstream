import { useNonInitialEffect, useObservable } from '@jetstream/shared/ui-utils';
import { InfoSuccessWarningError } from '@jetstream/types';
import React, { FunctionComponent, useState } from 'react';
import { Subject } from 'rxjs';
import { Toast } from './Toast';

const appToastMessage = new Subject<AppToastMessage>();
const appToastMessage$ = appToastMessage.asObservable();

const DEFAULT_DURATION = 5000;

export interface AppToastMessage {
  type: InfoSuccessWarningError;
  message: string | React.ReactNode | JSX.Element;
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
  const [nextId, setNextId] = useState<number>(0);

  useNonInitialEffect(() => {
    if (newMessage) {
      setActiveMessages((messages) => [...messages, { id: nextId, ...newMessage }]);
      setNextId(nextId + 1);
      autoDismissMessage(nextId, newMessage.duration ?? DEFAULT_DURATION);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newMessage]);

  function autoDismissMessage(id: number, duration: number) {
    if (duration && duration > 0) {
      setTimeout(() => handleClose(id), duration);
    }
  }

  function handleClose(id: number) {
    setActiveMessages((messages) => messages.filter((message) => message.id !== id));
  }

  return (
    <div className="slds-notify_container">
      {activeMessages
        .filter((_, i) => i < 3)
        .map(({ id, message, type }) => (
          <Toast key={id} className="" type={type} onClose={() => handleClose(id)} showIcon>
            {message}
          </Toast>
        ))}
    </div>
  );
};

export default AppToast;
