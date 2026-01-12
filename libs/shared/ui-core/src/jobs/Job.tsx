import { AsyncJob, AsyncJobType } from '@jetstream/types';
import { Icon, ProgressIndicator } from '@jetstream/ui';
import classNames from 'classnames';
import { formatDate } from 'date-fns/format';
import { formatDistanceToNow } from 'date-fns/formatDistanceToNow';
import isString from 'lodash/isString';
import { FunctionComponent } from 'react';
import { downloadJob } from './job-utils';

const JOBS_WITH_DOWNLOAD = new Set<AsyncJobType>(['BulkDelete', 'BulkUndelete']);
const JOBS_WITH_CANCEL = new Set<AsyncJobType>(['BulkDownload', 'RetrievePackageZip']);
const JOBS_WITH_LINK = new Set<AsyncJobType>(['BulkDownload', 'UploadToGoogle', 'RetrievePackageZip']);
const JOBS_WITH_TIMESTAMP_UPDATE = new Set<AsyncJobType>(['RetrievePackageZip', 'BulkDownload']);
const JOBS_WITH_FILE_ACTIONS = new Set<AsyncJobType>(['DesktopFileDownload']);

export interface JobProps {
  job: AsyncJob;
  cancelJob: (job: AsyncJob) => void;
  dismiss: (job: AsyncJob) => void;
}

export const Job: FunctionComponent<JobProps> = ({ job, cancelJob, dismiss }) => {
  const status = job.statusMessage || job.status;
  let message;
  let timestamp;
  if (job.lastActivity) {
    timestamp = formatDate(job.lastActivity, 'h:mm:ss');
  }
  const inProgress = job.status === 'pending' || job.status === 'in-progress';
  if (inProgress) {
    message = 'Job started ' + formatDistanceToNow(job.started, { addSuffix: true });
  } else {
    message = 'Job finished ' + formatDistanceToNow(job.finished, { addSuffix: true });
  }

  const handleOpenFile = async () => {
    if (window.electronAPI?.openFile && isString(job.results)) {
      await window.electronAPI.openFile(job.results);
    }
  };

  const handleShowInFolder = () => {
    if (window.electronAPI?.showFileInFolder && isString(job.results)) {
      window.electronAPI.showFileInFolder(job.results);
    }
  };

  return (
    <li className="slds-global-header__notification">
      <div className="slds-has-flexi-truncate slds-p-around_xxx-small">
        <div className="slds-grid slds-grid_align-spread">
          <div className="slds-has-flexi-truncate">
            <h3 className="slds-truncate" title={job.title}>
              <strong>{job.title}</strong>
            </h3>
            <p
              className="slds-truncate slds-text-color_weak slds-text-body_small"
              title={`${job.org.username} - ${job.org.instanceUrl} - ${job.org.orgOrganizationType}`}
            >
              Org: {job.org.username}
            </p>
            <p
              className={classNames('slds-line-clamp_small', {
                'slds-text-color_success': job.status === 'success',
                'slds-text-color_error': job.status === 'failed',
              })}
              title={status}
            >
              {status}
            </p>
            {job.progress && inProgress && (
              <div className="slds-m-top_x-small">
                {job.progress.label && <p className="slds-text-body_small slds-m-bottom_x-small">{job.progress.label}</p>}
                <ProgressIndicator currentValue={job.progress.percent} isIndeterminate={job.progress.percent === -1} />
                <p className="slds-text-body_small slds-m-top_x-small slds-text-align_center">
                  {job.progress.current} of {job.progress.total}
                  {job.progress.percent >= 0 ? ` (${job.progress.percent}%)` : ''}
                </p>
              </div>
            )}
            {inProgress && JOBS_WITH_TIMESTAMP_UPDATE.has(job.type) && (
              <p className="slds-text-color_weak slds-line-clamp_x-small" title={`Last Checked ${timestamp}`}>
                Last Checked {timestamp}
              </p>
            )}
            <p className="slds-text-color_weak">
              {inProgress && (
                <abbr className="slds-m-horizontal_xx-small">
                  <Icon
                    type="utility"
                    icon="sync"
                    className="slds-icon slds-icon-text-default slds-icon_xx-small"
                    containerClassname="slds-icon_container slds-icon-utility-sync"
                    description="job in progress"
                  />
                </abbr>
              )}
              {job.status === 'success' && (
                <abbr className="slds-m-horizontal_xx-small">
                  <Icon
                    type="utility"
                    icon="success"
                    className="slds-icon slds-icon-text-success slds-icon_xx-small"
                    containerClassname="slds-icon_container slds-icon-utility-success"
                    description="job success"
                  />
                </abbr>
              )}
              {job.status === 'finished-warning' && (
                <abbr className="slds-m-horizontal_xx-small">
                  <Icon
                    type="utility"
                    icon="warning"
                    className="slds-icon slds-icon-text-warning slds-icon_xx-small"
                    containerClassname="slds-icon_container slds-icon-utility-warning"
                    description="job success"
                  />
                </abbr>
              )}
              {job.status === 'aborted' && (
                <abbr className="slds-m-horizontal_xx-small">
                  <Icon
                    type="utility"
                    icon="info"
                    className="slds-icon slds-icon-text-info slds-icon_xx-small"
                    containerClassname="slds-icon_container slds-icon-utility-info"
                    description="job aborted"
                  />
                </abbr>
              )}
              {job.status === 'failed' && (
                <abbr className="slds-m-horizontal_xx-small">
                  <Icon
                    type="utility"
                    icon="error"
                    className="slds-icon slds-icon-text-error slds-icon_xx-small"
                    containerClassname="slds-icon_container slds-icon-utility-error"
                    description="jop error"
                  />
                </abbr>
              )}
              {message}
            </p>
          </div>
        </div>
        {inProgress && JOBS_WITH_CANCEL.has(job.type) && (
          <div className="slds-m-top_x-small slds-grid slds-grid_align-end">
            <div className="slds-col">
              <button className="slds-button slds-button_text-destructive" onClick={() => cancelJob(job)} disabled={job.cancelling}>
                <Icon type="utility" icon="delete" className="slds-button__icon slds-button__icon_left" omitContainer />
                {job.cancelling ? 'Attempting to cancel' : 'Cancel Job'}
              </button>
            </div>
          </div>
        )}
        {!inProgress && (
          <div className="slds-m-top_x-small">
            {JOBS_WITH_DOWNLOAD.has(job.type) && (
              <div className="slds-m-bottom_x-small">
                <button className="slds-button slds-button_neutral slds-button_stretch" onClick={() => downloadJob(job)}>
                  <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Download Results
                </button>
              </div>
            )}
            {JOBS_WITH_LINK.has(job.type) && isString(job.results) && (
              <div className="slds-m-bottom_x-small">
                <a href={job.results} className="slds-button slds-button_stretch" target="_blank" rel="noopener noreferrer">
                  View Results
                  <Icon
                    type="utility"
                    icon="new_window"
                    className="slds-icon slds-text-link slds-icon_xx-small cursor-pointer slds-m-left_xx-small"
                    omitContainer
                  />
                </a>
              </div>
            )}
            {JOBS_WITH_FILE_ACTIONS.has(job.type) && isString(job.results) && job.status === 'success' && (
              <>
                <div className="slds-m-bottom_x-small">
                  <button className="slds-button slds-button_neutral slds-button_stretch" onClick={handleOpenFile}>
                    <Icon type="utility" icon="open" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Open File
                  </button>
                </div>
                <div className="slds-m-bottom_x-small">
                  <button className="slds-button slds-button_neutral slds-button_stretch" onClick={handleShowInFolder}>
                    <Icon type="utility" icon="open_folder" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Show in Folder
                  </button>
                </div>
              </>
            )}
            <div>
              <button className="slds-button slds-button_neutral slds-button_stretch" onClick={() => dismiss(job)}>
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
};

export default Job;
