import React, { FunctionComponent } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface JobPlaceholderProps {}

export const JobPlaceholder: FunctionComponent<JobPlaceholderProps> = () => {
  return (
    <li className="slds-global-header__notification">
      <div className="slds-has-flexi-truncate slds-p-around_x-small">
        <div className="slds-grid slds-grid_align-spread">
          <div className="slds-has-flexi-truncate">
            <p className="slds-truncate" title="There are no active jobs">
              No background jobs have been submitted
            </p>
          </div>
        </div>
      </div>
    </li>
  );
};

export default JobPlaceholder;
