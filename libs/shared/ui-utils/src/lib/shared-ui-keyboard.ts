import { ListItem } from '@jetstream/types';
import escapeRegExp from 'lodash/escapeRegExp';
import type { KeyboardEvent, SyntheticEvent } from 'react';

export interface SelectMenuItemFromKeyboardOptions<T> {
  key: string;
  keyCode: number;
  keyBuffer: KeyBuffer;
  items: T[];
  labelProp: keyof T;
}

export class KeyBuffer {
  /* Copyright (c) 2015-present, salesforce.com, inc. All rights reserved */
  /* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */
  // https://github.com/salesforce/design-system-react/blob/master/utilities/key-buffer.js
  private buffer = '';
  private timeout: any;

  getValue(key: string) {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }

    this.timeout = setTimeout(() => {
      this.buffer = '';
    }, 400);

    this.buffer = this.buffer + key;
    return this.buffer;
  }
}

export function trapEvent(event: SyntheticEvent) {
  if (!event) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (event.nativeEvent && event.nativeEvent.preventDefault) {
    event.nativeEvent.preventDefault();
  }

  if (event.nativeEvent && event.nativeEvent.stopPropagation) {
    event.nativeEvent.stopPropagation();
  }
}

/**
 * The stopImmediatePropagation() method of the Event interface prevents other listeners of the same event from being called.
 *
 * If several listeners are attached to the same element for the same event type, they are called in the order in which they were added.
 * If stopImmediatePropagation() is invoked during one such call, no remaining listeners will be called.
 */
export function trapEventImmediate(event: SyntheticEvent) {
  if (!event) {
    return;
  }
  if (event.nativeEvent && event.nativeEvent.stopImmediatePropagation) {
    event.nativeEvent.stopImmediatePropagation();
  }
  trapEvent(event);
}

/**
 * Given a list of items (picklist), determine which is selected based on keys user is entering
 * @param param0 {SelectMenuItemFromKeyboardOptions}
 */
export function selectMenuItemFromKeyboard<T = ListItem>({
  key,
  keyCode,
  keyBuffer,
  items,
  labelProp,
}: SelectMenuItemFromKeyboardOptions<T>): number {
  /* Copyright (c) 2015-present, salesforce.com, inc. All rights reserved */
  /* Licensed under BSD 3-Clause - see LICENSE.txt or git.io/sfdc-license */
  // https://github.com/salesforce/design-system-react/blob/master/utilities/key-letter-menu-item-select.js
  let ch: string | null = key || String.fromCharCode(keyCode);

  if (/^[ -~]$/.test(ch)) {
    ch = ch.toLowerCase();
  } else {
    ch = null;
  }

  const pattern = ch ? keyBuffer.getValue(ch) : '';
  let consecutive = 0;
  let focusedIndex: number | undefined = undefined;

  // Support for navigating to the next option of the same letter with repeated presses of the same key
  if (ch && pattern.length > 1 && new RegExp(`^[${escapeRegExp(ch)}]+$`).test(pattern)) {
    consecutive = pattern.length;
  }

  items.forEach((item, i) => {
    const itemLabel = String(item[labelProp]).toLowerCase();

    if (
      (focusedIndex === undefined && itemLabel.substr(0, pattern.length) === pattern) ||
      (consecutive > 0 && itemLabel.substr(0, 1) === ch)
    ) {
      consecutive -= 1;
      focusedIndex = i;
    }
  });

  return focusedIndex ?? 0;
}

export function isAlphaNumericKey(event: KeyboardEvent<unknown>): boolean {
  const keyCode = event.keyCode ?? 0;
  return keyCode >= 48 && keyCode <= 90;
}

export function isAKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'a' || event.key === 'A' || event.keyCode === 65;
}

export function isCKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'c' || event.key === 'c' || event.keyCode === 67;
}

export function isHKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'h' || event.key === 'H' || event.keyCode === 72;
}

export function isKKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'k' || event.key === 'K' || event.code === 'KeyK';
}

export function isMKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'm' || event.key === 'M' || event.keyCode === 77;
}

export function isVKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'v' || event.code === 'KeyV' || event.keyCode === 86;
}

export function isArrowKey(event: KeyboardEvent<unknown>): boolean {
  return isArrowLeftKey(event) || isArrowUpKey(event) || isArrowRightKey(event) || isArrowDownKey(event);
}

export function isArrowLeftKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'ArrowLeft' || event.keyCode === 37;
}
export function isArrowUpKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'ArrowUp' || event.keyCode === 38;
}
export function isArrowRightKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'ArrowRight' || event.keyCode === 39;
}
export function isArrowDownKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'ArrowDown' || event.keyCode === 40;
}
export function isHomeKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'Home' || event.keyCode === 36;
}
export function isEndKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'End' || event.keyCode === 35;
}

export function isEnterKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'Enter' || event.keyCode === 13;
}

export function isSpaceKey(event: KeyboardEvent<unknown>): boolean {
  return event.keyCode === 32;
}

export function isEnterOrSpace(event: KeyboardEvent<unknown>): boolean {
  return isEnterKey(event) || isSpaceKey(event);
}

export function isEscapeKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'Escape' || event.keyCode === 27;
}
export function isBackspaceKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'Delete' || event.keyCode === 46;
}

export function isDeleteKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'Backspace' || event.keyCode === 8;
}

export function isBackspaceOrDeleteKey(event: KeyboardEvent<unknown>): boolean {
  return isBackspaceKey(event) || isDeleteKey(event);
}

export function isPageUpKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'PageUp' || event.keyCode === 33;
}

export function isPageDownKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'PageDown' || event.keyCode === 34;
}

export function isShiftKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'Shift' || event.keyCode === 16;
}

export function isControlKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'Control' || event.keyCode === 17;
}

export function isTabKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'Tab' || event.keyCode === 9;
}

export function hasAltModifierKey(event: KeyboardEvent<unknown>): boolean {
  return event.altKey;
}
export function hasMetaModifierKey(event: KeyboardEvent<unknown>): boolean {
  return event.metaKey;
}
export function hasCtrlModifierKey(event: KeyboardEvent<unknown>): boolean {
  return event.ctrlKey;
}

export function hasShiftModifierKey(event: KeyboardEvent<unknown>): boolean {
  return event.shiftKey;
}

export function hasCtrlOrMeta(event: KeyboardEvent<unknown>) {
  return hasMetaModifierKey(event) || hasCtrlModifierKey(event);
}

// excludes shift
export function hasModifierKey(event: KeyboardEvent<unknown>) {
  return hasAltModifierKey(event) || hasMetaModifierKey(event) || hasCtrlModifierKey(event);
}
