import { AsyncJob } from '@jetstream/types';
import { Icon } from '@jetstream/ui';
import moment from 'moment-mini';
import React, { FunctionComponent } from 'react';
import classNames from 'classnames';

export interface JobProps {
  job: AsyncJob;
}

export const Job: FunctionComponent<JobProps> = ({ job }) => {
  const status = job.statusMessage || job.status;
  let message;
  const inProgress = job.status === 'pending' || job.status === 'in-progress';
  if (inProgress) {
    message = 'Job started ' + moment(job.started).fromNow();
  } else {
    message = 'Job finished ' + moment(job.finished).fromNow();
  }
  return (
    <li className="slds-global-header__notification">
      <div className="slds-has-flexi-truncate slds-p-around_x-small">
        <div className="slds-grid slds-grid_align-spread">
          <div className="slds-has-flexi-truncate">
            <h3 className="slds-truncate" title={job.title}>
              <strong>{job.title}</strong>
            </h3>
            <p
              className={classNames('slds-truncate', {
                'slds-text-color_success': job.status === 'success',
                'slds-text-color_error': job.status === 'failed',
              })}
              title={status}
            >
              {status}
            </p>
            <p className="slds-text-color_weak">
              {inProgress && (
                <abbr className="slds-m-horizontal_xx-small">
                  <Icon
                    type="utility"
                    icon="sync"
                    className="slds-icon slds-icon-text-default slds-icon_xx-small"
                    containerClassname="slds-icon_container slds-icon-utility-sync"
                    description="in progress"
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
                    description="in progress"
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
                    description="in progress"
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
                    description="in progress"
                  />
                </abbr>
              )}
              {message}
              {/* TODO: have an optional link to SFDC or some abort action - would need to store data on the job to know what to do */}
            </p>
          </div>
        </div>
      </div>
    </li>
  );
};

export default Job;
