import { DetailedHTMLProps, HTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode, useId } from 'react';

interface InputProps {
  labelProps?: DetailedHTMLProps<LabelHTMLAttributes<HTMLLabelElement>, HTMLLabelElement>;
  inputProps?: DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
  containerProps?: DetailedHTMLProps<HTMLAttributes<HTMLDivElement>, HTMLDivElement>;
  children?: ReactNode;
}

export function Checkbox({ labelProps, inputProps, containerProps, children }: InputProps) {
  const id = useId();

  return (
    <div className="flex items-center" {...containerProps}>
      <input id={id} type="checkbox" className="h-4 w-4 rounded-sm border-gray-300 text-blue-600 focus:ring-blue-600" {...inputProps} />
      <label htmlFor={id} className="ml-3 block text-sm leading-6 text-gray-900" {...labelProps}>
        {children}
      </label>
    </div>
  );
}
