import { TimelinePipe } from '@pnp/core';
import { _Picker } from '../picker';

export function LogNotifications(): TimelinePipe<_Picker> {
  return (instance: _Picker) => {
    instance.on.notification(async function (this: _Picker, message) {
      this.log(`[${message.timestamp}] ${message.message}`, message.isExpected ? 0 : 1);
    });

    return instance;
  };
}
