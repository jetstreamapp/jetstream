import { logger } from '@jetstream/shared/client-logger';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { googleUploadFile } from '@jetstream/shared/data';
import { saveFile, useBrowserNotifications, useObservable, useRollbar } from '@jetstream/shared/ui-utils';
import { pluralizeIfMultiple } from '@jetstream/shared/utils';
import {
  AsyncJob,
  AsyncJobNew,
  AsyncJobType,
  AsyncJobWorkerMessageResponse,
  ErrorResult,
  MimeType,
  RecordResult,
  SalesforceOrgUi,
  WorkerMessage,
} from '@jetstream/types';
import { Icon, Popover } from '@jetstream/ui';
import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { filter } from 'rxjs/operators';
import { applicationCookieState, selectedOrgState } from '../../../app-state';
import JobsWorker from '../../../workers/jobs.worker';
import * as fromJetstreamEvents from '../jetstream-events';
import Job from './Job';
import JobPlaceholder from './JobPlaceholder';
import { jobsState, jobsUnreadState, selectActiveJobCount, selectJobs } from './jobs.state';

export const Jobs: FunctionComponent = () => {
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const rollbar = useRollbar();
  const setJobs = useSetRecoilState(jobsState);
  const [jobsUnread, setJobsUnread] = useRecoilState(jobsUnreadState);
  const [jobs, setJobsArr] = useRecoilState(selectJobs);
  const activeJobCount = useRecoilValue(selectActiveJobCount);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const newJobsToProcess = useObservable(fromJetstreamEvents.getObservable('newJob').pipe(filter((ev: AsyncJobNew[]) => ev.length > 0)));
  const { notifyUser } = useBrowserNotifications(serverUrl);
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
              let newJob = { ...data.job };
              if (error) {
                newJob = {
                  ...newJob,
                  finished: new Date(),
                  lastActivity: new Date(),
                  status: 'failed',
                  statusMessage: error || 'An unknown error ocurred',
                };
                notifyUser(`Delete records failed`, { body: newJob.statusMessage, tag: 'BulkDelete' });
              } else {
                const results: RecordResult[] = Array.isArray(data.results) ? data.results : [data.results];
                const firstErrorRec = results.filter((record) => !record.success) as ErrorResult[];

                newJob = {
                  ...newJob,
                  results,
                  finished: new Date(),
                  lastActivity: new Date(),
                  status: firstErrorRec.length ? 'failed' : 'success',
                  statusMessage: firstErrorRec.length
                    ? `${firstErrorRec.length} ${pluralizeIfMultiple('Error', firstErrorRec)} - ${
                        firstErrorRec[0]?.errors[0]?.message || 'An unknown error ocurred'
                      }`
                    : `${results.length.toLocaleString()} ${pluralizeIfMultiple('record', results)} deleted successfully`,
                };
                notifyUser(`Delete records finished`, { body: newJob.statusMessage, tag: 'BulkDelete' });
              }
              setJobs((prevJobs) => ({ ...prevJobs, [newJob.id]: newJob }));
            } catch (ex) {
              // TODO:
              logger.error('[ERROR][JOB] Error processing job results', ex);
            }
            break;
          }
          case 'BulkDownload': {
            try {
              let newJob = { ...data.job };
              if (error) {
                newJob = {
                  ...newJob,
                  finished: new Date(),
                  lastActivity: new Date(),
                  status: 'failed',
                  statusMessage: error || 'An unknown error ocurred',
                };
                notifyUser(`Download records failed`, { body: newJob.statusMessage, tag: 'BulkDownload' });
              } else {
                const { done, progress, fileData, fileName, fileFormat, googleFolder } = data.results as {
                  done: boolean;
                  progress: number;
                  fileData: any;
                  mimeType: MimeType;
                  fileName: string;
                  fileFormat: string;
                  googleFolder?: string;
                };
                let { mimeType } = data.results as { mimeType: MimeType };

                if (!done) {
                  newJob = {
                    ...newJob,
                    lastActivity: new Date(),
                    status: 'in-progress',
                    statusMessage: `Download in progress ${progress}%`,
                  };
                  setJobs((prevJobs) => ({ ...prevJobs, [newJob.id]: newJob }));
                } else {
                  newJob = {
                    ...newJob,
                    finished: new Date(),
                    lastActivity: new Date(),
                    status: 'success',
                    statusMessage: 'Records downloaded successfully',
                  };
                  // If user requested to save to gsheet
                  if (fileFormat === 'gsheet' && gapi?.client?.getToken()?.access_token) {
                    googleUploadFile(gapi?.client?.getToken()?.access_token, {
                      fileType: MIME_TYPES.CSV,
                      filename: fileName,
                      folderId: googleFolder,
                      fileData,
                    })
                      .then(({ id, webViewLink }) => {
                        newJob.results = webViewLink;
                      })
                      .catch((err) => {
                        newJob.statusMessage += ' (save to Google failed)';
                        mimeType = MIME_TYPES.CSV;
                        saveFile(fileData, fileName, mimeType);
                        notifyUser(`Download records finished (save to Google failed)`, { tag: 'BulkDownload' });
                        rollbar.error('Error saving to Google Drive', { err, message: err?.message });
                      })
                      .finally(() => {
                        setJobs((prevJobs) => ({ ...prevJobs, [newJob.id]: newJob }));
                      });
                  } else {
                    if (fileFormat === 'gsheet') {
                      newJob.statusMessage += ' (save to Google failed)';
                      mimeType = MIME_TYPES.CSV;
                    }
                    saveFile(fileData, fileName, mimeType);
                    notifyUser(`Download records finished`, { tag: 'BulkDownload' });
                    setJobs((prevJobs) => ({ ...prevJobs, [newJob.id]: newJob }));
                  }
                }
              }
            } catch (ex) {
              // TODO:
              logger.error('[ERROR][JOB] Error processing job results', ex);
            }
            break;
          }
          case 'RetrievePackageZip': {
            try {
              let newJob = { ...data.job };
              if (error) {
                newJob = {
                  ...newJob,
                  finished: new Date(),
                  lastActivity: new Date(),
                  status: 'failed',
                  statusMessage: error || 'An unknown error ocurred',
                };
                notifyUser(`Package download failed`, { body: newJob.statusMessage, tag: 'RetrievePackageZip' });
              } else if (data.lastActivityUpdate) {
                newJob = {
                  ...newJob,
                  lastActivity: new Date(),
                };
              } else {
                const { fileData, mimeType, fileName } = data.results as { fileData: ArrayBuffer; mimeType: MimeType; fileName: string };

                newJob = {
                  ...newJob,
                  finished: new Date(),
                  lastActivity: new Date(),
                  status: 'success',
                  statusMessage: 'Package downloaded successfully',
                };

                saveFile(fileData, fileName, mimeType);
                notifyUser(`Package download finished`, { tag: 'RetrievePackageZip' });
              }
              setJobs((prevJobs) => ({ ...prevJobs, [newJob.id]: newJob }));
            } catch (ex) {
              // TODO:
              logger.error('[ERROR][JOB] Error processing job results', ex);
            }
            break;
          }
          default:
            break;
        }
        if (data && data.lastActivityUpdate) {
          fromJetstreamEvents.emit({ type: 'lastActivityUpdate', payload: data.job });
        }
        if (data && !data.lastActivityUpdate && data.job) {
          fromJetstreamEvents.emit({ type: 'jobFinished', payload: data.job });
        }
      };
    }
  }, [jobsWorker, setJobs]);

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
