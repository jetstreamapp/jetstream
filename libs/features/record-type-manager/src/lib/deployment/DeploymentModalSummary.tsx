import { getNameOrNameAndLabel, getNameOrNameAndLabelFromObj } from '@jetstream/shared/utils';
import { RecordTypePicklistSummary } from '../types/record-types.types';

interface DeploymentSummaryProps {
  modifiedValues: RecordTypePicklistSummary[];
}

export function DeploymentSummary({ modifiedValues }: DeploymentSummaryProps) {
  const valuesByObject = modifiedValues.reduce((acc: Record<string, Record<string, RecordTypePicklistSummary[]>>, value) => {
    const sobjectName = getNameOrNameAndLabelFromObj(value, 'sobject', 'sobjectLabel');
    const recordType = getNameOrNameAndLabelFromObj(value, 'recordType', 'recordTypeLabel');
    acc[sobjectName] = acc[sobjectName] || {};
    acc[sobjectName][recordType] = acc[sobjectName][recordType] || [];
    acc[sobjectName][recordType].push(value);
    return acc;
  }, {});

  return (
    <div>
      {Object.entries(valuesByObject).map(([sobjectName, fields]) => (
        <div key={sobjectName}>
          <h1 className="slds-text-heading_medium">{sobjectName}</h1>
          {Object.entries(fields).map(([recordType, values]) => (
            <div key={recordType} className="slds-m-left_x-small">
              <h2 className="slds-text-heading_small ">{recordType}</h2>

              {values.map(({ field, defaultValue, fieldLabel }) => (
                <div key={field} className="slds-m-left_x-small">
                  <p className="text-bold">{getNameOrNameAndLabel(field, fieldLabel)}</p>
                  <div className="slds-m-left_x-small">
                    <p className="slds-line-clamp_small">{Array.from(values).join(', ')}</p>
                    {defaultValue && <p>Default: {defaultValue}</p>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
