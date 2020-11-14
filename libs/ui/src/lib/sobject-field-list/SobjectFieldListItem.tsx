/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { getFieldKey } from '@jetstream/shared/ui-utils';
import { FieldWrapper, MapOf, QueryFields } from '@jetstream/types';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import SobjectFieldList from './SobjectFieldList';
import SobjectFieldListType from './SobjectFieldListType';
import SobjectExpandChildrenBtn from './SobjectExpandChildrenBtn';

export interface SobjectFieldListItemProps {
  level: number;
  parentKey: string;
  field: FieldWrapper;
  queryFieldsMap: MapOf<QueryFields>;
  onToggleExpand: (key: string, field: FieldWrapper, relatedSobject: string) => void;
  onSelectField: (key: string, field: FieldWrapper) => void;
  onSelectAll: (key: string, value: boolean, impactedKeys: string[]) => void;
  onFilterChanged: (key: string, filterTerm: string) => void;
  errorReattempt: (key: string) => void;
}

export const SobjectFieldListItem: FunctionComponent<SobjectFieldListItemProps> = ({
  level,
  parentKey,
  field,
  queryFieldsMap,
  onToggleExpand,
  onSelectField,
  onSelectAll,
  onFilterChanged,
  errorReattempt,
}) => {
  const [relationshipKey, setRelationshipKey] = useState<string>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [selectedSObject, setSelectedSObject] = useState(queryFieldsMap[relationshipKey]?.sobject);

  function handleExpand(key: string, field: FieldWrapper, relatedSobject: string) {
    setSelectedSObject(relatedSobject);
    onToggleExpand(key, field, relatedSobject);
  }

  useEffect(() => {
    if (field.relatedSobject) {
      // setRelationshipKey(`${parentKey}${field.metadata.relationshipName}.`);
      setRelationshipKey(getFieldKey(parentKey, field.metadata));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field, field.relatedSobject]);

  useEffect(() => {
    if (relationshipKey && field.relatedSobject) {
      setIsExpanded(queryFieldsMap[relationshipKey]?.expanded || false);
    }
  }, [relationshipKey, field, queryFieldsMap]);

  return (
    <Fragment>
      <div className="slds-truncate" title={field.label} onClick={() => onSelectField(parentKey, field)}>
        {field.label}
      </div>
      <div className="slds-text-body_small slds-grid slds-grid_align-spread">
        <div
          css={css`
            min-width: 75px;
          `}
          className="slds-text-color_weak slds-truncate"
          title={field.name}
          onClick={() => onSelectField(parentKey, field)}
        >
          {field.name}
        </div>
        <SobjectFieldListType field={field} />
      </div>
      {field.relatedSobject && level < 5 && (
        <div
          css={css`
            margin-left: -1.75rem;
            margin-right: -1.25rem;
          `}
        >
          <SobjectExpandChildrenBtn
            initialSelectedSObject={queryFieldsMap[relationshipKey]?.sobject}
            parentKey={parentKey}
            field={field}
            isExpanded={isExpanded}
            onToggleExpand={handleExpand}
          />
          {isExpanded && (
            <div>
              <SobjectFieldList
                level={level + 1}
                itemKey={relationshipKey}
                queryFieldsMap={queryFieldsMap}
                sobject={selectedSObject}
                onToggleExpand={onToggleExpand}
                onSelectField={onSelectField}
                onSelectAll={onSelectAll}
                onFilterChanged={onFilterChanged}
                errorReattempt={errorReattempt}
              />
            </div>
          )}
        </div>
      )}
    </Fragment>
  );
};

export default SobjectFieldListItem;
