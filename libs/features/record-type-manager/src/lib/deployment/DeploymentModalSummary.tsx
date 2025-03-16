import { getNameOrNameAndLabel } from '@jetstream/shared/utils';
import { Accordion } from '@jetstream/ui';
import { RecordTypePicklistSummary, ViewMode } from '../types/record-types.types';

interface DeploymentSummaryProps {
  modifiedValues: RecordTypePicklistSummary[];
  viewMode: ViewMode;
}

export function DeploymentSummary({ modifiedValues, viewMode }: DeploymentSummaryProps) {
  const valuesByObjectBy = modifiedValues.reduce((acc: Record<string, Record<string, RecordTypePicklistSummary[]>>, value) => {
    const sobjectName = getNameOrNameAndLabel(value.sobject, value.sobjectLabel);
    const label =
      viewMode === 'FIELD'
        ? getNameOrNameAndLabel(value.field, value.fieldLabel)
        : getNameOrNameAndLabel(value.recordType, value.recordTypeLabel);
    acc[sobjectName] = acc[sobjectName] || {};
    acc[sobjectName][label] = acc[sobjectName][label] || [];
    acc[sobjectName][label].push(value);
    return acc;
  }, {});

  return (
    <div>
      <Accordion
        initOpenIds={Object.keys(valuesByObjectBy)}
        allowMultiple
        sections={Object.entries(valuesByObjectBy).map(([sobjectName, fieldOrRecordTypes]) => ({
          id: sobjectName,
          title: sobjectName,
          content: (
            <Accordion
              initOpenIds={Object.keys(fieldOrRecordTypes)}
              sections={Object.entries(fieldOrRecordTypes).map(([fieldOrRecordType, values]) => ({
                id: fieldOrRecordType,
                title: fieldOrRecordType,
                content: (
                  <>
                    {values.map(({ field, defaultValue, fieldLabel, recordType, recordTypeLabel, values }) => (
                      <div key={field} className="slds-m-left_x-small">
                        <p className="text-bold">
                          {viewMode === 'FIELD'
                            ? getNameOrNameAndLabel(recordType, recordTypeLabel)
                            : getNameOrNameAndLabel(field, fieldLabel)}
                        </p>
                        <div className="slds-m-left_x-small">
                          <p className="slds-line-clamp_small">{Array.from(values).join(', ')}</p>
                          {defaultValue && <p>Default: {defaultValue}</p>}
                        </div>
                      </div>
                    ))}
                  </>
                ),
              }))}
            />
          ),
        }))}
      />
    </div>
  );
}
