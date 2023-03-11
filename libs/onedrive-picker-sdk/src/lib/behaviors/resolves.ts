import { TimelinePipe } from '@pnp/core';
import { _Picker } from '../picker';

export function ResolveWithPicks(): TimelinePipe<_Picker> {
  return (instance: _Picker) => {
    instance.on.pick(async function (this: _Picker, data) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.emit[this.InternalResolveEvent](data);
    });

    return instance;
  };
}
