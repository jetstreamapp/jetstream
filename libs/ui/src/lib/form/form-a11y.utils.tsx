import { Children, cloneElement, isValidElement, ReactElement, ReactNode } from 'react';
import { ControlledInput } from './controlled-inputs/ControlledInput';
import { ControlledTextarea } from './controlled-inputs/ControlledTextarea';

const NATIVE_FORM_CONTROLS = new Set(['input', 'select', 'textarea']);
// Thin wrappers that spread every prop onto their native control, so stamping works the same way
const CONTROLLED_FORM_CONTROLS = new Set<unknown>([ControlledInput, ControlledTextarea]);

function isStampableControl(child: ReactNode): child is ReactElement<Record<string, unknown>> {
  if (!isValidElement(child)) {
    return false;
  }
  return (typeof child.type === 'string' && NATIVE_FORM_CONTROLS.has(child.type)) || CONTROLLED_FORM_CONTROLS.has(child.type);
}

/** Space-separated id list with duplicates removed; undefined when empty */
function mergeIdLists(...idLists: unknown[]) {
  const ids = idLists.flatMap((idList) => (typeof idList === 'string' ? idList.split(/\s+/) : [])).filter(Boolean);
  return ids.length ? Array.from(new Set(ids)).join(' ') : undefined;
}

/**
 * Form wrappers (Input, Select) receive their native control as children. So callers don't have to
 * wire error semantics on every call site, clone native form-control children and stamp
 * `aria-invalid` plus the error-message association when the wrapper is in an error state.
 * A caller-provided `aria-invalid` wins; a caller-provided `aria-describedby` is MERGED with the
 * wrapper's help/error ids (replacing it silently dropped the help text association).
 */
export function associateErrorsWithControls(
  children: ReactNode,
  hasError: boolean | undefined,
  errorMessageId: string | undefined,
  helpTextId?: string,
) {
  const describedBy = [helpTextId, hasError && errorMessageId ? errorMessageId : undefined].filter(Boolean).join(' ') || undefined;
  return Children.map(children, (child) => {
    if (!isStampableControl(child)) {
      return child;
    }
    const childProps = child.props;
    return cloneElement(child, {
      'aria-invalid': childProps['aria-invalid'] ?? (hasError || undefined),
      'aria-describedby': mergeIdLists(childProps['aria-describedby'], describedBy),
    });
  });
}
