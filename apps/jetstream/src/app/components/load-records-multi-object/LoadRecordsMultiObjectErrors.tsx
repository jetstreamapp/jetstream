/** @jsx jsx */
import { jsx } from '@emotion/react';
import { ScopedNotification } from '@jetstream/ui';
import { Fragment, FunctionComponent } from 'react';
import { LoadMultiObjectDataError } from './load-records-multi-object-types';

export interface LoadRecordsMultiObjectErrorsProps {
  errors: LoadMultiObjectDataError[];
}

export const LoadRecordsMultiObjectErrors: FunctionComponent<LoadRecordsMultiObjectErrorsProps> = ({ errors }) => {
  return (
    <Fragment>
      {!!errors?.length && (
        <ScopedNotification theme="error" className="slds-m-top_medium">
          {errors.length && (
            <div className="slds-text-heading_small slds-m-bottom_x-small">
              There are problems with your data that must be corrected to continue:
            </div>
          )}
          {errors.length === 1 ? (
            <div>
              {errors[0].message}
              <div>
                <strong>Worksheet</strong>: {errors[0].worksheet}, <strong>Location</strong>: {errors[0].location}
              </div>
            </div>
          ) : (
            <ul className="slds-list_dotted">
              {errors.map((error, i) => (
                <li key={i}>
                  {error.message} (<strong>Worksheet</strong>: {error.worksheet}, <strong>Location</strong>: {error.location})
                </li>
              ))}
            </ul>
          )}
        </ScopedNotification>
      )}
    </Fragment>
  );
};

export default LoadRecordsMultiObjectErrors;
