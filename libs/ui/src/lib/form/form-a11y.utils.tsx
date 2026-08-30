import { Children, cloneElement, isValidElement, ReactElement, ReactNode } from 'react';

const NATIVE_FORM_CONTROLS = new Set(['input', 'select', 'textarea']);

/**
 * Form wrappers (Input, Select) receive their native control as children. So callers don't have to
 * wire error semantics on every call site, clone native form-control children and stamp
 * `aria-invalid` plus the error-message association when the wrapper is in an error state.
 * Caller-provided aria attributes always win.
 */
export function associateErrorsWithControls(children: ReactNode, hasError: boolean | undefined, errorMessageId: string | undefined) {
  return Children.map(children, (child) => {
    if (!isValidElement(child) || typeof child.type !== 'string' || !NATIVE_FORM_CONTROLS.has(child.type)) {
      return child;
    }
    const childProps = (child as ReactElement<Record<string, unknown>>).props;
    return cloneElement(child as ReactElement<Record<string, unknown>>, {
      'aria-invalid': childProps['aria-invalid'] ?? (hasError || undefined),
      'aria-describedby': childProps['aria-describedby'] ?? (hasError && errorMessageId ? errorMessageId : undefined),
    });
  });
}
