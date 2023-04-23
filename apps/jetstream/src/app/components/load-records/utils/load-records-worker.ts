import { externalMessagePorts } from '../../core/electron-utils';

const loadWorker = new Worker(new URL('../load-records.worker.ts', import.meta.url), { type: 'module' });

if (loadWorker && window.electron?.isElectron) {
  externalMessagePorts.loadWorkerPort
    ? loadWorker.postMessage({ name: 'isElectron' }, [externalMessagePorts.loadWorkerPort])
    : loadWorker.postMessage({ name: 'isElectron' }, []);
}

export function getLoadWorker() {
  return loadWorker;
}
