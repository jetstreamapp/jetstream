import { nanoid } from 'nanoid';
import { useState } from 'react';

function getDescribedBy(labelHelpId = '', helpTextId = '', errorMessageId = '') {
  return [labelHelpId || '', helpTextId || '', errorMessageId || ''].join(' ').trim();
}

/**
 * Returns all the ids and aria described by that a form may need
 * @param idPrefix
 */
export function useFormIds(idPrefix?: string) {
  const [_idPrefix] = useState(idPrefix || nanoid());
  const [formId] = useState(`${_idPrefix}-form`);
  const [labelHelpId] = useState(`${_idPrefix}-label-help-text`);
  const [helpTextId] = useState(`${_idPrefix}-help-text`);
  const [errorMessageId] = useState(`${_idPrefix}-error-message`);
  const [ariaDescribedbyText] = useState(getDescribedBy(labelHelpId, helpTextId, errorMessageId));

  return {
    formId,
    ariaDescribedbyText,
    labelHelpId,
    helpTextId,
    errorMessageId,
  };
}
