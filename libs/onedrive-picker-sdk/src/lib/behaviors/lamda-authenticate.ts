import { TimelinePipe } from '@pnp/core';
import { _Picker } from '../picker';
import { IAuthenticateCommand } from '../types';

export function LamdaAuthenticate(getToken: (command: IAuthenticateCommand) => Promise<string>): TimelinePipe<_Picker> {
  return (instance: _Picker) => {
    instance.on.authenticate(async function (this: _Picker, command, result) {
      if (typeof result === 'undefined') {
        try {
          const accessToken = await getToken(command);

          if (accessToken) {
            this.log(`Returning token for auth type: '${command.type}'`, 0);
            result = {
              result: 'token',
              token: accessToken,
            };
          }
        } catch (e) {
          this.error(e);
        }
      }

      return [command, result];
    });

    return instance;
  };
}
