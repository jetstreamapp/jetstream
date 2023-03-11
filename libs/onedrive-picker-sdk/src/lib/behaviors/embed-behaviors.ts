import { TimelinePipe } from '@pnp/core';
import { Setup } from './setup';
import { PickObserver, _Picker } from '../picker';
import { LogNotifications } from './log-notifications';

export function Embed(onPick: PickObserver): TimelinePipe<_Picker> {
  return (instance: _Picker) => {
    instance.using(Setup(), LogNotifications());

    instance.on.pick(onPick);

    return instance;
  };
}
