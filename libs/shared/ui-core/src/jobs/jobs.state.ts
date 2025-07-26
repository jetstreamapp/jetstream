import { AsyncJob, AsyncJobStatus } from '@jetstream/types';
import { atom } from 'jotai';

const activeStatuses: AsyncJobStatus[] = ['pending', 'in-progress'];

export const jobsState = atom<Record<string, AsyncJob<unknown>>>({});

export const jobsUnreadState = atom<boolean>(false);

export const selectJobs = atom(
  (get) => Object.values(get(jobsState)),
  (get, set, newJobs: AsyncJob<unknown>[]) => {
    if (!Array.isArray(newJobs)) {
      return;
    }
    set(
      jobsState,
      newJobs.reduce((newJobObj: Record<string, AsyncJob<unknown>>, job) => {
        newJobObj[job.id] = job;
        return newJobObj;
      }, {})
    );
  }
);

export const selectActiveJobCount = atom((get) => get(selectJobs).filter((job) => activeStatuses.includes(job.status)).length);
