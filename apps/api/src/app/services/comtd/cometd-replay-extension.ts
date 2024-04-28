/**
 * ENDED UP NOT USING THIS STUFF
 */
import { CometD, Extension, Message } from 'cometd';
import { isNumber } from 'lodash';

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

//         const replayFromMap: Record<string, number> = {};
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
  cometd: CometD;
  extensionEnabled = true;
  replayFromMap: Record<string, number | undefined> = {};

  setEnabled(extensionEnabled: boolean) {
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

  registered(name: string, cometd: CometD) {
    this.cometd = cometd;
  }

  incoming(message: Message) {
    if (isNumber(this.replayFromMap[message.channel]) && message.data?.event?.replayId) {
      this.replayFromMap[message.channel] = message.data.event.replayId;
      return message;
    }
    return null;
  }

  outgoing(message: Message) {
    if (message.channel === '/meta/subscribe') {
      if (this.extensionEnabled) {
        if (!message.ext) {
          message.ext = {};
        }
        message.ext[CometdReplayExtension.REPLAY_FROM_KEY] = this.replayFromMap;
      }
      return message;
    }
    return null;
  }
}
