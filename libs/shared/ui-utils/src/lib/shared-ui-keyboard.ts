import { KeyboardEvent } from 'react';

export function isAKey(event: KeyboardEvent<unknown>): boolean {
  return event.key === 'a' || event.key === 'A' || event.keyCode === 65;
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

// excludes shift
export function hasModifierKey(event: KeyboardEvent<unknown>) {
  return hasAltModifierKey(event) || hasMetaModifierKey(event) || hasCtrlModifierKey(event);
}

export function selectMenuItemFromKeyboard() {}
