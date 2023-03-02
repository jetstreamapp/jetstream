import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { FieldWrapper, MapOf, Maybe, QueryFields } from '@jetstream/types';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import Select from '../form/select/Select';
import Icon from '../widgets/Icon';

const relationshipHelpText =
  'This relationship can be associated to a different object for each record. ' +
  'Only records associated to the selected object will display the selected fields, ' +
  'and other records will only display the Id of the related record.';

export interface SobjectExpandChildrenBtnProps {
  initialSelectedSObject?: string;
  parentKey: string;
  itemKey: string;
  queryFieldsMap: MapOf<QueryFields>;
  field: FieldWrapper;
  isExpanded: boolean;
  allowMultiple: boolean;
  onToggleExpand: (key: string, field: FieldWrapper, relatedSobject: string) => void;
}

export const SobjectExpandChildrenBtn: FunctionComponent<SobjectExpandChildrenBtnProps> = ({
  initialSelectedSObject,
  parentKey,
  itemKey,
  queryFieldsMap,
  field,
  isExpanded,
  allowMultiple,
  onToggleExpand,
}) => {
  const selectedChildFields = queryFieldsMap?.[itemKey]?.selectedFields?.size;
  const selectedChildFieldsTitle = selectedChildFields
    ? `${formatNumber(selectedChildFields)} ${pluralizeFromNumber('field', selectedChildFields)} selected`
    : null;
  const hasMultiple = Array.isArray(field.relatedSobject);
  const showWhich = hasMultiple && allowMultiple ? 'multiple' : 'single';
  const [selectedSObject, setSelectedSObject] = useState<Maybe<string>>(
    () => initialSelectedSObject || (hasMultiple ? field.relatedSobject?.[0] : (field.relatedSobject as string))
  );
  const [selectId] = useState(() => `select-${parentKey}-${field.name}`);

  useEffect(() => {
    if (initialSelectedSObject && initialSelectedSObject !== selectedSObject) {
      setSelectedSObject(initialSelectedSObject);
    }
  }, [initialSelectedSObject]);

  function handleExpand(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    event.preventDefault();
    event.stopPropagation();
    selectedSObject && onToggleExpand(parentKey, field, selectedSObject);
  }

  return (
    <Fragment>
      {showWhich === 'multiple' && (
        <Fragment>
          <Select id={selectId} label="Which Related Object" labelHelp={relationshipHelpText}>
            <select
              className="slds-select"
              id={selectId}
              value={selectedSObject || undefined}
              onChange={(event) => setSelectedSObject(event.target.value)}
              disabled={isExpanded}
              title={isExpanded ? 'Hide fields to enable this element' : ''}
            >
              {(field.relatedSobject as string[]).map((relationship) => (
                <option key={relationship} value={relationship}>
                  {relationship}
                </option>
              ))}
            </select>
          </Select>
          <button className="slds-button" onClick={handleExpand}>
            <Icon type="utility" icon={isExpanded ? 'dash' : 'add'} className="slds-button__icon slds-button__icon_left" />
            {isExpanded ? 'Hide' : 'View'} {selectedSObject} Fields
            {selectedChildFields ? (
              <span className="slds-m-left_xxx-small" title={selectedChildFieldsTitle || undefined}>
                ({selectedChildFields})
              </span>
            ) : null}
          </button>
        </Fragment>
      )}
      {showWhich === 'single' && (
        <button className="slds-button" onClick={handleExpand}>
          <Icon type="utility" icon={isExpanded ? 'dash' : 'add'} className="slds-button__icon slds-button__icon_left" />
          {isExpanded ? 'Hide' : 'View'} {selectedSObject} Fields{' '}
          {selectedChildFields ? (
            <span className="slds-m-left_xxx-small" title={selectedChildFieldsTitle || undefined}>
              ({selectedChildFields})
            </span>
          ) : null}
        </button>
      )}
    </Fragment>
  );
};

export default SobjectExpandChildrenBtn;
