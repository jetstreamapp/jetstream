import { _Picker } from './lib/picker';

export * from './lib/behaviors/popup-behaviors';
export * from './lib/behaviors/setup';
export * from './lib/behaviors/msal-authenticate';
export * from './lib/behaviors/lamda-authenticate';
export * from './lib/behaviors/resolves';
export * from './lib/behaviors/errors';
export * from './lib/behaviors/embed-behaviors';
export * from './lib/behaviors/log-notifications';
export * from './lib/types';

export type PickerInit = [];

export function Picker(window: Window): _Picker {
  if (typeof window === 'undefined') {
    throw Error('You must supply a valid Window for the picker to render within.');
  }

  return new _Picker(window);
}

export type IPicker = ReturnType<typeof Picker>;
