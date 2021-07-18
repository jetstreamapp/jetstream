/** @jsx jsx */
import { jsx } from '@emotion/react';
import { MapOf } from '@jetstream/types';
import { ScopedNotification } from '@jetstream/ui';
import { groupBy } from 'lodash';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { LoadMultiObjectDataError } from './load-records-multi-object-types';

export interface LoadRecordsMultiObjectErrorsProps {
  errors: LoadMultiObjectDataError[];
}

function getErrorLocation(error: LoadMultiObjectDataError) {
  if (!error.location) {
    return null;
  }
  return error.locationType === 'ROW' ? <span>(Row {error.location})</span> : <span>(Cell {error.location})</span>;
}

export const LoadRecordsMultiObjectErrors: FunctionComponent<LoadRecordsMultiObjectErrorsProps> = ({ errors }) => {
  const [errorsByWorksheet, setErrorsByWorksheet] = useState<MapOf<LoadMultiObjectDataError[]>>();

  useEffect(() => {
    setErrorsByWorksheet(groupBy(errors, 'worksheet'));
  }, [errors]);

  return (
    <Fragment>
      {!!errors?.length && errorsByWorksheet && (
        <ScopedNotification theme="error" className="slds-m-top_medium">
          <div className="slds-text-heading_small">There are problems with your data that must be corrected to continue:</div>
          {Object.keys(errorsByWorksheet).map((worksheet) => {
            const currErrors = errorsByWorksheet[worksheet];
            return (
              <div key={worksheet} className="slds-m-left_small slds-m-top_x-small">
                <div>{worksheet} worksheet</div>

                <ul className="slds-list_dotted">
                  {currErrors.map((error, i) => (
                    <li key={i}>
                      {error.message} {getErrorLocation(error)}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <div></div>
        </ScopedNotification>
      )}
    </Fragment>
  );
};

export default LoadRecordsMultiObjectErrors;
