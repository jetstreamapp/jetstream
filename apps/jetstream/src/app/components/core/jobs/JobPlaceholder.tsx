import { FunctionComponent } from 'react';

export const JobPlaceholder: FunctionComponent = () => {
  return (
    <li className="slds-global-header__notification">
      <div className="slds-has-flexi-truncate slds-p-around_x-small">
        <div className="slds-grid slds-grid_align-spread">
          <div className="slds-has-flexi-truncate">
            <p className="slds-truncate" title="There are no active jobs">
              You don't have any background jobs.
            </p>
          </div>
        </div>
      </div>
    </li>
  );
};

export default JobPlaceholder;
