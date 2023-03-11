/* eslint-disable @typescript-eslint/ban-ts-comment */
import { TimelinePipe } from '@pnp/core';
import { LogNotifications } from './log-notifications';
import { _Picker } from '../picker';
import { ResolveWithPicks } from './resolves';
import { Setup } from './setup';

export function Close(): TimelinePipe<_Picker> {
  return (instance: _Picker) => {
    instance.on.close(function (this: _Picker) {
      // @ts-ignore
      this.emit[this.InternalResolveEvent](null);
      this.window.close();
    });

    return instance;
  };
}

export function CloseOnPick(): TimelinePipe<_Picker> {
  return (instance: _Picker) => {
    instance.on.pick(async function (this: _Picker, data) {
      this.window.close();
    });

    return instance;
  };
}

export function Popup(): TimelinePipe<_Picker> {
  return (instance: _Picker) => {
    instance.using(Setup(), Close(), LogNotifications(), ResolveWithPicks(), CloseOnPick());

    return instance;
  };
}
