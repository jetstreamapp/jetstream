/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { FunctionComponent, Fragment, useState, useEffect } from 'react';
import { FieldWrapper } from '@jetstream/types';
import Icon from '../widgets/Icon';
import Select from '../form/select/Select';

const relationshipHelpText =
  'This relationship can be associated to a different object for each record. ' +
  'Only records associated to the selected object will display the selected fields, ' +
  'and other records will only display the Id of the related record.';

export interface SobjectExpandChildrenBtnProps {
  initialSelectedSObject: string;
  parentKey: string;
  field: FieldWrapper;
  isExpanded: boolean;
  onToggleExpand: (key: string, field: FieldWrapper, relatedSobject: string) => void;
}

export const SobjectExpandChildrenBtn: FunctionComponent<SobjectExpandChildrenBtnProps> = ({
  initialSelectedSObject,
  parentKey,
  field,
  isExpanded,
  onToggleExpand,
}) => {
  const hasMultiple = Array.isArray(field.relatedSobject);
  const [selectedSObject, setSelectedSObject] = useState<string>(
    () => initialSelectedSObject || (hasMultiple ? field.relatedSobject[0] : (field.relatedSobject as string))
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
    onToggleExpand(parentKey, field, selectedSObject);
  }

  return (
    <Fragment>
      {hasMultiple && (
        <Fragment>
          <Select id={selectId} label="Which Related Object" labelHelp={relationshipHelpText}>
            <select
              className="slds-select"
              id={selectId}
              value={selectedSObject}
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
          </button>
        </Fragment>
      )}
      {!hasMultiple && (
        <button className="slds-button" onClick={handleExpand}>
          <Icon type="utility" icon={isExpanded ? 'dash' : 'add'} className="slds-button__icon slds-button__icon_left" />
          {isExpanded ? 'Hide' : 'View'} {selectedSObject} Fields
        </button>
      )}
    </Fragment>
  );
};

export default SobjectExpandChildrenBtn;
