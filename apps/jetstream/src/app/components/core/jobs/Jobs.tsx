import { logger } from '@jetstream/shared/client-logger';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { saveFile, useObservable } from '@jetstream/shared/ui-utils';
import { pluralizeIfMultiple } from '@jetstream/shared/utils';
import {
  AsyncJob,
  AsyncJobNew,
  AsyncJobType,
  AsyncJobWorkerMessageResponse,
  ErrorResult,
  MapOf,
  RecordResult,
  SalesforceOrgUi,
  WorkerMessage,
} from '@jetstream/types';
import { Icon, Popover } from '@jetstream/ui';
import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { filter, map } from 'rxjs/operators';
import { selectedOrgState } from '../../../app-state';
import JobsWorker from '../../../workers/jobs.worker';
import * as fromJetstreamEvents from '../jetstream-events';
import Job from './Job';
import JobPlaceholder from './JobPlaceholder';
import { jobsState, jobsUnreadState, selectActiveJobCount, selectJobs } from './jobs.state';
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface JobsProps {}

export const Jobs: FunctionComponent<JobsProps> = () => {
  const [jobsObj, setJobs] = useRecoilState(jobsState);
  const [jobsUnread, setJobsUnread] = useRecoilState(jobsUnreadState);
  const [jobs, setJobsArr] = useRecoilState(selectJobs);
  const activeJobCount = useRecoilValue(selectActiveJobCount);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const newJobsToProcess = useObservable(fromJetstreamEvents.getObservable('newJob').pipe(filter((ev: AsyncJobNew[]) => ev.length > 0)));

  const [jobsWorker] = useState(() => new JobsWorker());

  useEffect(() => {
    if (!!jobsWorker && newJobsToProcess && newJobsToProcess.length > 0) {
      const newJobs = newJobsToProcess.map(
        (job): AsyncJob<unknown> => ({
          ...job,
          id: uniqueId(job.type),
          started: new Date(),
          finished: new Date(),
          lastActivity: new Date(),
          status: 'in-progress',
        })
      );
      newJobs.forEach((job) => {
        jobsWorker.postMessage({
          name: job.type,
          data: {
            job: { ...job },
            org: selectedOrg,
          },
        });
      });
      setIsPopoverOpen(true);
      setJobsArr(newJobs.concat(jobs));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newJobsToProcess]);

  useEffect(() => {
    if (jobsWorker) {
      jobsWorker.onmessage = (event: MessageEvent) => {
        logger.info(event.data);
        const { name, data, error } = event.data as WorkerMessage<AsyncJobType, AsyncJobWorkerMessageResponse>;
        switch (name) {
          case 'BulkDelete': {
            try {
              const newJobs = { ...jobsObj };
              const { job } = data;
              if (error) {
                newJobs[job.id] = {
                  ...job,
                  finished: new Date(),
                  lastActivity: new Date(),
                  status: 'failed',
                  statusMessage: error || 'An unknown error ocurred',
                };
              } else {
                const results: RecordResult[] = Array.isArray(data.results) ? data.results : [data.results];
                const firstErrorRec = results.filter((record) => !record.success) as ErrorResult[];

                newJobs[job.id] = {
                  ...job,
                  results,
                  finished: new Date(),
                  lastActivity: new Date(),
                  status: firstErrorRec.length ? 'failed' : 'success',
                  statusMessage: firstErrorRec.length
                    ? `${firstErrorRec.length} ${pluralizeIfMultiple('Error', firstErrorRec)} - ${
                        firstErrorRec[0]?.errors[0]?.message || 'An unknown error ocurred'
                      }`
                    : 'Record was deleted successfully',
                };
              }
              setJobs(newJobs);
            } catch (ex) {
              // TODO:
            }
            break;
          }
          case 'BulkDownload': {
            try {
              const newJobs = { ...jobsObj };
              const { job } = data;
              if (error) {
                newJobs[job.id] = {
                  ...job,
                  finished: new Date(),
                  lastActivity: new Date(),
                  status: 'failed',
                  statusMessage: error || 'An unknown error ocurred',
                };
              } else {
                const { fileData, fileName, mimeType } = data.results as { fileData: any; mimeType: MimeType; fileName: string };

                newJobs[job.id] = {
                  ...job,
                  finished: new Date(),
                  lastActivity: new Date(),
                  status: 'success',
                  statusMessage: 'Records downloaded successfully',
                };

                saveFile(fileData, fileName, mimeType);
              }
              setJobs(newJobs);
            } catch (ex) {
              // TODO:
            }
            break;
          }
          default:
            break;
        }
        if (data && data.job) {
          fromJetstreamEvents.emit({ type: 'jobFinished', payload: data.job });
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsWorker]);

  function handleDismiss(job: AsyncJob) {
    setJobsArr(jobs.filter(({ id }) => id !== job.id));
  }

  return (
    <Popover
      isOpen={isPopoverOpen}
      onOpen={() => setIsPopoverOpen(true)}
      onClose={() => setIsPopoverOpen(false)}
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small" id="background-jobs" title="Background Jobs">
            Background Jobs
          </h2>
        </header>
      }
      content={
        <div className="slds-popover__body slds-p-around_none">
          <ul>
            {jobs.map((job) => (
              <Job key={job.id} job={job} dismiss={handleDismiss} />
            ))}
            {!jobs.length && <JobPlaceholder />}
          </ul>
        </div>
      }
    >
      <div className="slds-dropdown-trigger slds-dropdown-trigger_click">
        <button
          className={classNames(
            'slds-button slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__notifications slds-global-actions__item-action',
            { 'slds-incoming-notification': activeJobCount || jobsUnread }
          )}
          title={`${activeJobCount} active job(s)`}
          aria-live="assertive"
          aria-atomic="true"
        >
          <Icon type="utility" icon="notification" className="slds-button__icon slds-global-header__icon" omitContainer />
          <span className="slds-assistive-text">{`${activeJobCount} active job(s)`}</span>
        </button>
        {/* Show number of in progress jobs or just an indication that there are finished jobs that have not been viewed */}
        {(activeJobCount || jobsUnread) && (
          <span aria-hidden="true" className="slds-notification-badge slds-incoming-notification slds-show-notification">
            {activeJobCount ? activeJobCount : ' '}
          </span>
        )}
      </div>
    </Popover>
  );
};

export default Jobs;
