import { XCircleIcon, XIcon } from '@heroicons/react/solid';
import classNames from 'classnames';
import { useEffect, useState } from 'react';

const errorClassMap = {
  error: {
    container: 'bg-red-50',
    icon: 'text-red-400',
    message: 'text-red-700',
  },
  success: {
    container: 'bg-green-50',
    icon: 'text-green-400',
    message: 'text-green-700',
  },
  info: {
    container: 'bg-blue-50',
    icon: 'text-blue-400',
    message: 'text-blue-700',
  },
  warning: {
    container: 'bg-yellow-50',
    icon: 'text-yellow-400',
    message: 'text-yellow-700',
  },
};

interface AlertProps {
  message: string;
  type?: keyof typeof errorClassMap;
  dismissable?: boolean;
}

export default function Alert({ message, type = 'error', dismissable }: AlertProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [message]);

  if (dismissed) {
    return null;
  }

  return (
    <div className={classNames('rounded-md p-4', errorClassMap[type].container)}>
      <div className="flex">
        <div className="flex-shrink-0">
          <XCircleIcon aria-hidden="true" className={classNames('h-5 w-5', errorClassMap[type].icon)} />
        </div>
        <div className="ml-3">
          <div className={classNames('text-sm', errorClassMap[type].message)}>
            <p>{message}</p>
          </div>
        </div>
        {dismissable && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                className="inline-flex rounded-md p-1.5 text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-600 focus:ring-offset-2 focus:ring-offset-gray-50"
                onClick={() => setDismissed(true)}
              >
                <span className="sr-only">Dismiss</span>
                <XIcon aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
