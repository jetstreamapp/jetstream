import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { fileExtToGoogleDriveMimeType, fileExtToMimeType, MIME_TYPES } from '@jetstream/shared/constants';
import { googleUploadFile } from '@jetstream/shared/data';
import { saveFile, useBrowserNotifications, useObservable, useRollbar } from '@jetstream/shared/ui-utils';
import { getErrorMessage, pluralizeIfMultiple } from '@jetstream/shared/utils';
import {
  AsyncJob,
  AsyncJobNew,
  AsyncJobType,
  AsyncJobWorkerMessagePayload,
  AsyncJobWorkerMessageResponse,
  ErrorResult,
  FileExtAllTypes,
  FileExtCsvXLSX,
  Maybe,
  MimeType,
  RecordResult,
  UploadToGoogleJob,
  WorkerMessage,
} from '@jetstream/types';
import { Icon, Popover, PopoverRef } from '@jetstream/ui';
import { applicationCookieState } from '@jetstream/ui/app-state';
import classNames from 'classnames';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import uniqueId from 'lodash/uniqueId';
import { FunctionComponent, useCallback, useEffect, useRef } from 'react';
import { filter } from 'rxjs/operators';
import { fromJetstreamEvents } from '../jetstream-events';
import Job from './Job';
import JobPlaceholder from './JobPlaceholder';
import { jobsState, jobsUnreadState, selectActiveJobCount, selectJobs } from './jobs.state';
import { WorkerAdapter } from './JobWorker';

export interface WorkerCompatibleShim {
  postMessage: (message: WorkerMessage<AsyncJobType, AsyncJobWorkerMessagePayload>) => void;
  onmessage?: (event: { data: WorkerMessage<AsyncJobType, AsyncJobWorkerMessageResponse> }) => void;
}

const jobsWorker = new WorkerAdapter();

export const Jobs: FunctionComponent = () => {
  const popoverRef = useRef<PopoverRef>(null);
  const isOpen = useRef<boolean>(false);
  const [{ serverUrl, defaultApiVersion }] = useAtom(applicationCookieState);
  const rollbar = useRollbar();
  const setJobs = useSetAtom(jobsState);
  const [jobsUnread, setJobsUnread] = useAtom(jobsUnreadState);
  const [jobs, setJobsArr] = useAtom(selectJobs);
  const activeJobCount = useAtomValue(selectActiveJobCount);
  const newJobsToProcess = useObservable(
    fromJetstreamEvents.getObservable('newJob').pipe(filter((ev) => Array.isArray(ev) && ev.length > 0)),
  ) as AsyncJobNew[];
  const { notifyUser } = useBrowserNotifications(serverUrl);

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
        }),
      );
      newJobs.forEach((job) => {
        jobsWorker.postMessage({
          name: job.type,
          data: {
            job: { ...job },
            org: job.org,
            apiVersion: defaultApiVersion,
          },
        });
      });
      setTimeout(() => popoverRef.current?.open());
      setJobsArr(newJobs.concat(jobs));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newJobsToProcess]);

  const uploadToGoogleDrive = useCallback(
    ({
      newJob,
      fileName,
      googleFolder,
      fileData,
      fileType,
    }: {
      newJob: AsyncJob<any>;
      fileName: string;
      googleFolder: Maybe<string>;
      fileData: any;
      fileType: FileExtCsvXLSX | 'zip';
    }) => {
      return googleUploadFile(
        gapi.client.getToken().access_token,
        {
          fileMimeType: fileType === 'xlsx' ? MIME_TYPES.XLSX_OPEN_OFFICE : fileExtToMimeType[fileType].replace(';charset=utf-8', ''),
          filename: fileName,
          folderId: googleFolder,
          fileData,
        },
        fileExtToGoogleDriveMimeType[fileType],
      )
        .then(({ id, webViewLink }) => {
          newJob.results = webViewLink;
        })
        .catch((err) => {
          handleGoogleUploadFailure({ fileData, fileName, fileType }, newJob);
          rollbar.error('Error saving to Google Drive', { err, message: err?.message });
        })
        .finally(() => {
          setJobs((prevJobs) => ({
            ...prevJobs,
            [newJob.id]: {
              ...newJob,
              finished: new Date(),
              lastActivity: new Date(),
            },
          }));
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleEvent = useCallback(({ name, data, error }: WorkerMessage<AsyncJobType, AsyncJobWorkerMessageResponse>) => {
    logger.info('[WORKER EVENT]', { name, data, error });
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
              statusMessage: error || 'An unknown error occurred',
            };
            setJobs((prevJobs) => ({ ...prevJobs, [newJob.id]: newJob }));
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
                    firstErrorRec[0]?.errors[0]?.message || 'An unknown error occurred'
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
      case 'BulkUndelete': {
        try {
          let newJob = { ...data.job };
          if (error) {
            newJob = {
              ...newJob,
              finished: new Date(),
              lastActivity: new Date(),
              status: 'failed',
              statusMessage: error || 'An unknown error occurred',
            };
            setJobs((prevJobs) => ({ ...prevJobs, [newJob.id]: newJob }));
            notifyUser(`Restore records failed`, { body: newJob.statusMessage, tag: 'BulkUndelete' });
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
                    firstErrorRec[0]?.errors[0]?.message || 'An unknown error occurred'
                  }`
                : `${results.length.toLocaleString()} ${pluralizeIfMultiple('record', results)} restored successfully`,
            };
            notifyUser(`Restore records finished`, { body: newJob.statusMessage, tag: 'BulkUndelete' });
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
              statusMessage: error || 'An unknown error occurred',
            };
            setJobs((prevJobs) => ({ ...prevJobs, [newJob.id]: newJob }));
            notifyUser(`Download records failed`, { body: newJob.statusMessage, tag: 'BulkDownload' });
          } else if (data.lastActivityUpdate) {
            newJob = {
              ...newJob,
              lastActivity: new Date(),
            };
            setJobs((prevJobs) => ({ ...prevJobs, [newJob.id]: newJob }));
          } else {
            const { done, progress, fileData, useBulkApi, fileFormat, results, googleFolder } = data.results as {
              done: boolean;
              progress: number;
              fileData: any;
              useBulkApi?: boolean;
              mimeType: MimeType;
              fileFormat: string;
              results?: string;
              googleFolder?: string;
            };
            let { fileName, mimeType } = data.results as { fileName: string; mimeType: MimeType };

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
              if (useBulkApi) {
                if (results) {
                  if (fileFormat === 'gdrive' && gapi?.client?.getToken()?.access_token) {
                    fetch(results)
                      .then(async (response) => {
                        if (!response.ok || !response.body) {
                          throw new Error('Failed to download file from Salesforce');
                        }
                        return response.text();
                      })
                      .then((response) => {
                        setJobs((prevJobs) => ({
                          ...prevJobs,
                          [newJob.id]: {
                            ...newJob,
                            lastActivity: new Date(),
                            status: 'in-progress',
                            statusMessage: 'Uploading file to Google',
                          },
                        }));
                        uploadToGoogleDrive({
                          fileData: response,
                          fileName,
                          googleFolder,
                          newJob,
                          fileType: 'csv',
                        });
                      })
                      .catch((error) => {
                        newJob = {
                          ...newJob,
                          finished: new Date(),
                          lastActivity: new Date(),
                          status: 'failed',
                          statusMessage: getErrorMessage(error),
                        };
                      });
                  } else {
                    fromJetstreamEvents.emit({
                      type: 'streamFileDownload',
                      payload: {
                        fileName,
                        link: results,
                      },
                    });
                    setJobs((prevJobs) => ({
                      ...prevJobs,
                      [newJob.id]: {
                        ...newJob,
                        results,
                        finished: new Date(),
                        lastActivity: new Date(),
                      },
                    }));
                  }
                } else {
                  // TODO: handle error
                }
              } else if (fileFormat === 'gdrive' && gapi?.client?.getToken()?.access_token) {
                // show status of uploading to Google
                setJobs((prevJobs) => ({
                  ...prevJobs,
                  [newJob.id]: {
                    ...newJob,
                    lastActivity: new Date(),
                    status: 'in-progress',
                    statusMessage: 'Uploading file to Google',
                  },
                }));

                newJob = {
                  ...newJob,
                  status: 'success',
                  statusMessage: 'Records downloaded and saved to Google successfully',
                };

                uploadToGoogleDrive({ fileData, fileName, googleFolder, newJob, fileType: 'xlsx' });
              } else {
                if (fileFormat === 'gdrive') {
                  // Failed to upload to google, save locally
                  mimeType = MIME_TYPES.XLSX;
                  fileName = `${fileName}.xlsx`;
                  newJob.statusMessage = 'Records downloaded and saved to computer, saving to Google failed.';
                  newJob.status = 'finished-warning';
                }
                saveFile(fileData, fileName, mimeType);
                notifyUser(`Download records finished`, { tag: 'BulkDownload' });
                setJobs((prevJobs) => ({
                  ...prevJobs,
                  [newJob.id]: {
                    ...newJob,
                    finished: new Date(),
                    lastActivity: new Date(),
                  },
                }));
              }
            }
          }
        } catch (ex) {
          // TODO:
          logger.error('[ERROR][JOB] Error processing job results', ex);
        }
        break;
      }
      case 'UploadToGoogle': {
        try {
          // TODO: can we share code with bulk download?
          let newJob = { ...data.job };
          const { fileName, fileData, fileType, googleFolder } = data.results as UploadToGoogleJob;
          newJob = {
            ...newJob,
            lastActivity: new Date(),
            status: 'in-progress',
            statusMessage: 'Uploading file to Google',
          };
          setJobs((prevJobs) => ({ ...prevJobs, [newJob.id]: newJob }));

          newJob = {
            ...newJob,
            status: 'success',
            statusMessage: 'Records downloaded and saved to Google successfully',
          };

          if (gapi?.client?.getToken()?.access_token) {
            uploadToGoogleDrive({ fileData, fileName, googleFolder, fileType, newJob });
          } else {
            handleGoogleUploadFailure({ fileData, fileName, fileType }, newJob);
            setJobs((prevJobs) => ({
              ...prevJobs,
              [newJob.id]: {
                ...newJob,
                finished: new Date(),
                lastActivity: new Date(),
              },
            }));
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
              statusMessage: error || 'An unknown error occurred',
            };
            notifyUser(`Package download failed`, { body: newJob.statusMessage, tag: 'RetrievePackageZip' });
            setJobs((prevJobs) => ({ ...prevJobs, [newJob.id]: newJob }));
          } else if (data.lastActivityUpdate) {
            newJob = {
              ...newJob,
              lastActivity: new Date(),
            };
            setJobs((prevJobs) => ({ ...prevJobs, [newJob.id]: newJob }));
          } else {
            const { fileData, mimeType, fileName, fileFormat, uploadToGoogle, googleFolder } = data.results as {
              fileData: ArrayBuffer;
              mimeType: MimeType;
              fileName: string;
              fileFormat: FileExtAllTypes;
              uploadToGoogle: boolean;
              googleFolder?: string;
            };

            if (!uploadToGoogle) {
              newJob = {
                ...newJob,
                finished: new Date(),
                lastActivity: new Date(),
                status: 'success',
                statusMessage: 'Package downloaded successfully',
              };

              saveFile(fileData, `${fileName}.${fileFormat}`, mimeType);
              notifyUser(`Package download finished`, { tag: 'RetrievePackageZip' });
              setJobs((prevJobs) => ({ ...prevJobs, [newJob.id]: newJob }));
            } else {
              newJob = {
                ...newJob,
                lastActivity: new Date(),
                status: 'in-progress',
                statusMessage: 'Uploading file to Google',
              };
              setJobs((prevJobs) => ({ ...prevJobs, [newJob.id]: newJob }));

              newJob = {
                ...newJob,
                status: 'success',
                statusMessage: 'Package saved to Google successfully',
              };

              if (gapi?.client?.getToken()?.access_token) {
                const targetMimeType = (fileExtToGoogleDriveMimeType as any)[fileFormat];
                uploadToGoogleDrive({
                  fileData,
                  fileName: targetMimeType === MIME_TYPES.GSHEET ? fileName : `${fileName}.${fileFormat}`,
                  googleFolder,
                  newJob,
                  fileType: fileFormat as any,
                });
              } else {
                handleGoogleUploadFailure({ fileData, fileName, fileType: 'zip' }, newJob);
                setJobs((prevJobs) => ({
                  ...prevJobs,
                  [newJob.id]: {
                    ...newJob,
                    finished: new Date(),
                    lastActivity: new Date(),
                  },
                }));
              }
            }
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (jobsWorker) {
      jobsWorker.onmessage = (event: MessageEvent) => {
        handleEvent(event.data as WorkerMessage<AsyncJobType, AsyncJobWorkerMessageResponse>);
      };
    }
  }, [handleEvent, setJobs]);

  function handleGoogleUploadFailure(
    {
      fileData,
      fileName,
      fileType,
    }: {
      fileData: any;
      fileName: string;
      fileType: FileExtAllTypes;
    },
    newJob: AsyncJob<unknown, unknown>,
    statusMessage = 'Records downloaded and saved to computer, saving to Google failed.',
    tag = 'UploadToGoogle',
  ) {
    fileName = `${fileName}.${fileType}`;
    // Failed to upload to google, save locally
    newJob.statusMessage = statusMessage;
    newJob.status = 'finished-warning';
    saveFile(fileData, fileName, (fileExtToMimeType as any)[fileType]);
    notifyUser(newJob.statusMessage, { tag });
  }

  function handleDismiss(job: AsyncJob) {
    const newJobs = jobs.filter(({ id }) => id !== job.id);
    setJobsArr(newJobs);
    if (newJobs.length === 0) {
      popoverRef.current?.close();
    }
  }

  function cancelJob(job: AsyncJob) {
    if (jobsWorker) {
      jobsWorker.postMessage({
        name: 'CancelJob',
        data: {
          job: { ...job, meta: null, results: null },
          org: job.org,
          apiVersion: defaultApiVersion,
        },
      });
      setJobs((prevJobs) => ({
        ...prevJobs,
        [job.id]: {
          ...job,
          cancelling: true,
        },
      }));
    }
  }

  return (
    <Popover
      ref={popoverRef}
      onChange={(open) => (isOpen.current = open)}
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small" id="background-jobs" title="Background Jobs">
            Background Jobs
          </h2>
        </header>
      }
      content={
        <div
          className="slds-popover__body slds-p-around_none"
          css={css`
            overflow-y: auto;
            max-height: 80vh;
          `}
        >
          <ul>
            {jobs.map((job) => (
              <Job key={job.id} job={job} cancelJob={cancelJob} dismiss={handleDismiss} />
            ))}
            {!jobs.length && <JobPlaceholder />}
          </ul>
        </div>
      }
      buttonProps={{
        className: classNames(
          'slds-dropdown-trigger slds-dropdown-trigger_click slds-button slds-button_icon slds-button_icon-container slds-button_icon-small slds-global-actions__notifications slds-global-actions__item-action',
          { 'slds-incoming-notification': activeJobCount || jobsUnread },
        ),
        title: `${activeJobCount} active job(s)`,
        'aria-live': 'assertive',
        'aria-atomic': true,
      }}
      // Show number of in progress jobs or just an indication that there are finished jobs that have not been viewed
      triggerAfterContent={
        (activeJobCount || jobsUnread) && (
          <span aria-hidden="true" className="slds-notification-badge slds-incoming-notification slds-show-notification">
            {activeJobCount ? activeJobCount : ' '}
          </span>
        )
      }
    >
      <Icon type="utility" icon="notification" className="slds-button__icon slds-global-header__icon" omitContainer />
      <span className="slds-assistive-text">{`${activeJobCount} active job(s)`}</span>
    </Popover>
  );
};

export default Jobs;
