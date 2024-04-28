import { css } from '@emotion/react';
import { getFieldKey } from '@jetstream/shared/ui-utils';
import { FieldWrapper, QueryFields, SalesforceOrgUi } from '@jetstream/types';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import Grid from '../grid/Grid';
import { useHighlightedText } from '../hooks/useHighlightedText';
import Icon from '../widgets/Icon';
import Tooltip from '../widgets/Tooltip';
import SobjectExpandChildrenBtn from './SobjectExpandChildrenBtn';
import SobjectFieldList from './SobjectFieldList';
import SobjectFieldListMetadataWarning from './SobjectFieldListMetadataWarning';
import SobjectFieldListType from './SobjectFieldListType';
import WhereIsThisFieldUsed from './WhereIsThisFieldUsed';

export interface SobjectFieldListItemProps {
  org: SalesforceOrgUi;
  serverUrl: string;
  isTooling: boolean;
  level: number;
  parentKey: string;
  field: FieldWrapper;
  queryFieldsMap: Record<string, QueryFields>;
  searchTerm?: string;
  highlightText?: boolean;
  onToggleExpand: (key: string, field: FieldWrapper, relatedSobject: string) => void;
  onSelectField: (key: string, field: FieldWrapper) => void;
  onSelectAll: (key: string, value: boolean, impactedKeys: string[]) => void;
  onFilterChanged: (key: string, filterTerm: string) => void;
  errorReattempt: (key: string) => void;
}

export const SobjectFieldListItem: FunctionComponent<SobjectFieldListItemProps> = ({
  org,
  serverUrl,
  isTooling,
  level,
  parentKey,
  field,
  queryFieldsMap,
  searchTerm,
  highlightText,
  onToggleExpand,
  onSelectField,
  onSelectAll,
  onFilterChanged,
  errorReattempt,
}) => {
  const [relationshipKey, setRelationshipKey] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [selectedSObject, setSelectedSObject] = useState(() => {
    return relationshipKey && queryFieldsMap[relationshipKey]?.sobject;
  });
  const fieldLabel = useHighlightedText(field.label, searchTerm, { ignoreHighlight: !highlightText });
  const fieldName = useHighlightedText(field.name, searchTerm, { ignoreHighlight: !highlightText });

  const isSelected = queryFieldsMap[parentKey]?.selectedFields?.has(field.name);

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
      // Ensure that on query restore, the selected sobject is set otherwise the child list will not render
      queryFieldsMap[relationshipKey]?.expanded && setSelectedSObject(queryFieldsMap[relationshipKey]?.sobject);
    }
  }, [relationshipKey, field, queryFieldsMap]);

  return (
    <Fragment>
      <Grid>
        <div className="slds-truncate" title={field.label}>
          {fieldLabel}
          {field.metadata.inlineHelpText && (
            <Tooltip
              id={`${parentKey}-${relationshipKey}-${field.name}-helptext`}
              content={field.metadata.inlineHelpText}
              className="slds-m-left_xx-small"
            >
              <Icon type="utility" icon="info" className="slds-icon slds-icon-text-default slds-icon_xx-small cursor-pointer" />
              <span className="slds-assistive-text">{field.metadata.inlineHelpText}</span>
            </Tooltip>
          )}
        </div>
        {isTooling && isSelected && <SobjectFieldListMetadataWarning apiName={field.name} />}
        {!isTooling && (
          <div className="slds-col_bump-left slds-m-bottom_xx-small">
            <WhereIsThisFieldUsed org={org} sobject={field.sobject} field={field.metadata.name} />
          </div>
        )}
      </Grid>
      <div className="slds-text-body_small slds-grid slds-grid_align-spread">
        <div
          css={css`
            min-width: 75px;
          `}
          className="slds-text-color_weak slds-truncate"
          title={field.name}
        >
          {fieldName}
        </div>
        <SobjectFieldListType org={org} field={field} />
      </div>
      {field.relatedSobject && level < 5 && relationshipKey && (
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
            itemKey={relationshipKey}
            queryFieldsMap={queryFieldsMap}
            allowMultiple={level === 0}
            onToggleExpand={handleExpand}
          />
          {isExpanded && selectedSObject && (
            <div>
              <SobjectFieldList
                key={selectedSObject}
                org={org}
                serverUrl={serverUrl}
                isTooling={isTooling}
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
