/**
 * ENDED UP NOT USING THIS STUFF
 */
import { MapOf } from '@jetstream/types';
import { CometD, Message } from 'cometd';
import { isNumber } from 'lodash';

// Library types for this are incorrect
interface Extension {
  incoming?: (message: Message) => void | undefined;
  outgoing?: (message: Message) => void | undefined;
  registered?: ((name: string, cometd: CometD) => void) | undefined;
  unregistered?: (() => void) | undefined;
}

/*
https://github.com/developerforce/StreamingReplayClientExtensions/blob/master/javascript/cometdReplayExtension.js

Copyright (c) 2016, Salesforce Developers
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

* Redistributions of source code must retain the above copyright notice, this
  list of conditions and the following disclaimer.

* Redistributions in binary form must reproduce the above copyright notice,
  this list of conditions and the following disclaimer in the documentation
  and/or other materials provided with the distribution.

* Neither the name of StreamingReplayClientExtensions nor the names of its
  contributors may be used to endorse or promote products derived from
  this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/
// export const cometdReplayExtension = function (channel?: string, replay?: number) {
//   const REPLAY_FROM_KEY = 'replay';

//   let _cometd: CometD;
//   let _extensionEnabled = true;
//   let _replay: number = replay || -1;
//   let _channel: string = channel;

//   this.registered = function (name, cometd) {
//     _cometd = cometd;
//   };

//   this.incoming = function (message: Message) {
//     if (message.channel === _channel && message.data?.event?.replayId) {
//       _replay = message.data.event.replayId;
//     }
//   };

//   this.outgoing = function (message: Message) {
//     if (message.channel === '/meta/subscribe') {
//       if (_extensionEnabled) {
//         if (!message.ext) {
//           message.ext = {};
//         }

//         const replayFromMap: MapOf<number> = {};
//         replayFromMap[_channel] = _replay;

//         // add "ext: { "replay" : { CHANNEL : REPLAY_VALUE }}" to subscribe message
//         message.ext[REPLAY_FROM_KEY] = replayFromMap;
//       }
//     }
//   };
// };

export class CometdReplayExtension implements Extension {
  static EXT_NAME = 'replay-extension';
  static REPLAY_FROM_KEY = 'replay';

  public cometd: CometD;
  public extensionEnabled = true;
  public replayFromMap: MapOf<number | undefined> = {};

  // Do I need both of these? does the name matter?
  setEnabled(extensionEnabled: boolean) {
    this.extensionEnabled = extensionEnabled;
  }

  setExtensionEnabled(extensionEnabled: boolean) {
    this.extensionEnabled = extensionEnabled;
  }

  addChannel(channel: string, replay?: number) {
    channel = channel.startsWith('/event') ? channel : `/event/${channel}`;
    this.replayFromMap[channel] = replay ?? -1;
  }

  removeChannel(channel: string) {
    channel = channel.startsWith('/event') ? channel : `/event/${channel}`;
    this.replayFromMap[channel] = undefined;
  }

  removeAllChannels() {
    this.replayFromMap = {};
  }

  registered(name: string, cometd: CometD) {
    this.cometd = cometd;
  }

  incoming(message: Message) {
    if (isNumber(this.replayFromMap[message.channel]) && message.data?.event?.replayId) {
      this.replayFromMap[message.channel] = message.data.event.replayId;
      // return message; // FIXME: these are required based on type, but do they cause problems?
    }
    // return null; // FIXME: these are required based on type, but do they cause problems?
  }

  outgoing(message: Message) {
    if (message.channel === '/meta/subscribe') {
      if (this.extensionEnabled) {
        if (!message.ext) {
          message.ext = {};
        }
        message.ext[CometdReplayExtension.REPLAY_FROM_KEY] = this.replayFromMap;
      }
      // return message; // FIXME: these are required based on type, but do they cause problems?
    }
    // return null; // FIXME: these are required based on type, but do they cause problems?
  }
}

// export const cometdReplayExtension = function () {
//   const REPLAY_FROM_KEY = 'replay';

//   let _cometd: CometD;
//   let _extensionEnabled = false;
//   let _replay: number;
//   let _channel: string;

//   this.setExtensionEnabled = function (extensionEnabled: boolean) {
//     _extensionEnabled = extensionEnabled;
//   };

//   this.setReplay = function (replay: string) {
//     _replay = parseInt(replay, 10);
//   };

//   this.setChannel = function (channel: string) {
//     _channel = channel;
//   };

//   this.registered = function (name: string, cometd: CometD) {
//     _cometd = cometd;
//   };

//   this.incoming = function (message: Message) {
//     if (message.channel === '/meta/handshake') {
//       if (message.ext && message.ext[REPLAY_FROM_KEY] == true) {
//         _extensionEnabled = true;
//       }
//     } else if (message.channel === _channel && message.data && message.data.event && message.data.event.replayId) {
//       _replay = message.data.event.replayId;
//     }
//   };

//   this.outgoing = function (message: Message) {
//     if (message.channel === '/meta/subscribe') {
//       if (_extensionEnabled) {
//         if (!message.ext) {
//           message.ext = {};
//         }

//         const replayFromMap = {};
//         replayFromMap[_channel] = _replay;

//         // add "ext : { "replay" : { CHANNEL : REPLAY_VALUE }}" to subscribe message
//         message.ext[REPLAY_FROM_KEY] = replayFromMap;
//       }
//     }
//   };
// };

// export class CometdReplayExtension implements Extension {
//   public REPLAY_FROM_KEY = 'replay';

//   public _cometd: CometD;
//   public _extensionEnabled = false;
//   public _replay: number;
//   public _channel: string;
//   public replayFromMap: Record<string, number> = {};

//   public setExtensionEnabled = (extensionEnabled: boolean) => {
//     this._extensionEnabled = extensionEnabled;
//   };

//   public setReplay = (replay: string) => {
//     this._replay = parseInt(replay, 10);
//   };

//   public setChannel = (channel: string) => {
//     this._channel = channel;
//   };

//   public registered = (name: string, cometd: CometD) => {
//     this._cometd = cometd;
//   };

//   public incoming = (message: Message) => {
//     if (message.channel === '/meta/handshake') {
//       if (message.ext && message.ext[this.REPLAY_FROM_KEY] == true) {
//         this._extensionEnabled = true;
//       }
//     } else if (message.channel === this._channel && message.data && message.data.event && message.data.event.replayId) {
//       this._replay = message.data.event.replayId;
//     }
//     return null;
//   };

//   public outgoing = (message: Message) => {
//     if (message.channel === '/meta/subscribe') {
//       if (this._extensionEnabled) {
//         if (!message.ext) {
//           message.ext = {};
//         }

//         this.replayFromMap[this._channel] = this._replay;
//         // add "ext : { "replay" : { CHANNEL : REPLAY_VALUE }}" to subscribe message
//         message.ext[this.REPLAY_FROM_KEY] = this.replayFromMap;
//       }
//     }
//     return null;
//   };

//   public removeChannel = (channel: string) => {
//     this.replayFromMap[this._channel] = this._replay;
//   }
// }
