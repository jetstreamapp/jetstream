/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { MapOf } from '@silverthorn/types';
import { Fragment, FunctionComponent, useState, useEffect } from 'react';
import { FieldWrapper, QueryFields } from '@silverthorn/types';
import Icon from '../widgets/Icon';
import SobjectFieldList from './SobjectFieldList';
import SobjectFieldListType from './SobjectFieldListType';

export interface SobjectFieldListItemProps {
  level: number;
  parentKey: string;
  field: FieldWrapper;
  queryFieldsMap: MapOf<QueryFields>;
  onToggleExpand: (key: string, field: FieldWrapper) => void;
  onSelectField: (key: string, field: FieldWrapper) => void;
  onSelectAll: (key: string, value: boolean) => void;
  onFilterChanged: (key: string, filterTerm: string) => void;
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
}) => {
  const [relationshipKey, setRelationshipKey] = useState<string>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  function handleExpand(event: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    event.preventDefault();
    event.stopPropagation();
    onToggleExpand(parentKey, field);
  }

  useEffect(() => {
    if (field.relatedSobject) {
      setRelationshipKey(`${parentKey}${field.metadata.relationshipName}.`);
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
      <div className="slds-truncate" title={field.label}>
        {field.label}
      </div>
      <div className="slds-text-body_small slds-grid slds-grid_align-spread">
        <div className="slds-text-color_weak slds-truncate" title={field.name}>
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
          <button className="slds-button" onClick={handleExpand}>
            <Icon type="utility" icon={isExpanded ? 'dash' : 'add'} className="slds-button__icon slds-button__icon_left" />
            {isExpanded ? 'Hide' : 'View'} {field.relatedSobject} Fields
          </button>
          {isExpanded && (
            <div>
              <SobjectFieldList
                level={level + 1}
                itemKey={relationshipKey}
                queryFieldsMap={queryFieldsMap}
                sobject={field.relatedSobject}
                onToggleExpand={onToggleExpand}
                onSelectField={onSelectField}
                onSelectAll={onSelectAll}
                onFilterChanged={onFilterChanged}
              />
            </div>
          )}
        </div>
      )}
    </Fragment>
  );
};

export default SobjectFieldListItem;
