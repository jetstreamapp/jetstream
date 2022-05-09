import ipc from 'node-ipc';
import { rendererAppName } from './constants';

// ipc.config.silent = true;

function isSocketTaken(name: string) {
  return new Promise((resolve, reject) => {
    ipc.connectTo(name, () => {
      ipc.of[name].on('error', () => {
        ipc.disconnect(name);
        resolve(false);
      });

      ipc.of[name].on('connect', () => {
        ipc.disconnect(name);
        resolve(true);
      });
    });
  });
}

export async function findOpenSocket() {
  let currentSocket = 1;
  console.log('checking for available socket', currentSocket);
  let socketName = `${rendererAppName}${currentSocket}`;
  while (await isSocketTaken(socketName)) {
    currentSocket++;
    socketName = `${rendererAppName}${currentSocket}`;
  }
  console.log('found available socket', socketName);
  return socketName;
}
