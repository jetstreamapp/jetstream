import { TimelinePipe } from '@pnp/core';
import { _Picker } from '../picker';

export function RejectOnErrors(): TimelinePipe<_Picker> {
  return (instance: _Picker) => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    instance.on.error(function (this: _Picker, err) {
      (this.emit as any)[this.InternalRejectEvent](err || null);
    });

    return instance;
  };
}
