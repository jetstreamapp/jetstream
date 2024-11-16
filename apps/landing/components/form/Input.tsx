import { ExclamationCircleIcon } from '@heroicons/react/solid';
import classNames from 'classnames';
import { DetailedHTMLProps, HTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode, useId } from 'react';

interface InputProps {
  label: string;
  error?: string;
  labelProps?: DetailedHTMLProps<LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>;
  inputProps?: DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
  inputContainerProps?: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
  children?: ReactNode;
}

export function Input({ label, error, labelProps, inputProps, inputContainerProps, children }: InputProps) {
  const id = useId();

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium leading-6 text-gray-900" {...labelProps}>
        {label}
      </label>
      <div className="relative mt-2 rounded-md shadow-sm" {...inputContainerProps}>
        <input
          id={id}
          className={classNames(
            'block w-full rounded-md border-0 py-1.5 ring-1 ring-inset focus:ring-2 focus:ring-inset sm:text-sm sm:leading-6',
            {
              'text-gray-900 shadow-sm  ring-gray-300 placeholder:text-gray-400 focus:ring-blue-600': !error,
              'pr-8 text-red-900  ring-red-300 placeholder:text-red-300 focus:ring-red-500': error,
            }
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          {...inputProps}
        />
        {error && (
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
            <ExclamationCircleIcon aria-hidden="true" className="h-5 w-5 text-red-500" />
          </div>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {children}
    </div>
  );
}
