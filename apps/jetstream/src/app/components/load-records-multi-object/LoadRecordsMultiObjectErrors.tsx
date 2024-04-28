import { ScopedNotification } from '@jetstream/ui';
import groupBy from 'lodash/groupBy';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { LoadMultiObjectDataError } from './load-records-multi-object-types';

export interface LoadRecordsMultiObjectErrorsProps {
  errors: LoadMultiObjectDataError[];
}

function getErrorLocation(error: LoadMultiObjectDataError) {
  if (!error.location) {
    return null;
  }
  let descriptor = '';
  switch (error.locationType) {
    case 'ROW':
      descriptor = 'Row';
      break;
    case 'COLUMN':
      descriptor = 'Column';
      break;
    case 'CELL':
    default:
      descriptor = 'Cell';
      break;
  }
  return (
    <span>
      ({descriptor} {error.location})
    </span>
  );
}

export const LoadRecordsMultiObjectErrors: FunctionComponent<LoadRecordsMultiObjectErrorsProps> = ({ errors }) => {
  const [errorsByWorksheet, setErrorsByWorksheet] = useState<Record<string, LoadMultiObjectDataError[]>>();

  useEffect(() => {
    setErrorsByWorksheet(groupBy(errors, 'worksheet'));
  }, [errors]);

  return (
    // eslint-disable-next-line react/jsx-no-useless-fragment
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
