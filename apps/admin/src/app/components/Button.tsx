import { ButtonHTMLAttributes } from 'react';
import { Link, LinkProps } from 'react-router';
import { classNames } from '../utils/class-names';
import { Spinner } from './Spinner';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white shadow-sm hover:bg-blue-500 focus-visible:outline-blue-600 disabled:bg-blue-300',
  secondary: 'bg-white text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-500 focus-visible:outline-red-600 disabled:bg-red-300',
  ghost: 'text-slate-700 hover:bg-slate-100 disabled:text-slate-400',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-2.5 py-1 text-xs',
  md: 'px-3 py-2 text-sm',
};

export function buttonClassName(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', className?: string) {
  return classNames(
    'inline-flex items-center justify-center gap-1.5 rounded-md font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export function Button({ variant, size, loading, className, disabled, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClassName(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
}

export interface ButtonLinkProps extends LinkProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function ButtonLink({ variant, size, className, ...rest }: ButtonLinkProps) {
  return <Link className={buttonClassName(variant, size, typeof className === 'string' ? className : undefined)} {...rest} />;
}
