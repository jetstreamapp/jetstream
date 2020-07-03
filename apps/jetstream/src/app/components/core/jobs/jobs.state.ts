import { AsyncJob, MapOf, AsyncJobStatus, AsyncJobNew } from '@jetstream/types';
import { atom, selector } from 'recoil';

const activeStatuses: AsyncJobStatus[] = ['pending', 'in-progress'];

export const jobsToProcessState = atom<AsyncJobNew[]>({
  key: 'jobs.jobsToProcessState',
  default: [],
});

export const jobsState = atom<MapOf<AsyncJob<unknown>>>({
  key: 'jobs.jobsState',
  default: {},
});

export const jobsUnreadState = atom<boolean>({
  key: 'jobs.jobsUnreadState',
  default: false,
});

export const selectJobs = selector({
  key: 'jobs.selectJobs',
  get: ({ get }) => Object.values(get(jobsState)),
  set: ({ get, set }, newJobs: AsyncJob<unknown>[]) => {
    const jobs = { ...get(jobsState) };
    newJobs.forEach((job) => {
      jobs[job.id] = job;
    });
    set(jobsState, jobs);
  },
});

export const selectActiveJobCount = selector({
  key: 'jobs.selectActiveJobCount',
  get: ({ get }) => get(selectJobs).filter((job) => activeStatuses.includes(job.status)).length,
});
