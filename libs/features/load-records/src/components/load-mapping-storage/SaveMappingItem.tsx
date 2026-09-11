import { DATE_FORMATS } from '@jetstream/shared/constants';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeIfMultiple } from '@jetstream/shared/utils';
import { FieldMappingItem, LoadSavedMappingItem } from '@jetstream/types';
import { ButtonGroupContainer, DropDown, Grid, Tooltip } from '@jetstream/ui';
import { isStaticValuePlaceholder, SELF_LOOKUP_KEY } from '@jetstream/ui-core';
import { formatDate } from 'date-fns/format';
import isDate from 'lodash/isDate';
import { FunctionComponent } from 'react';

export interface SaveMappingItemProps {
  mapping: LoadSavedMappingItem;
  onButtonAction: (id: string, metadata: LoadSavedMappingItem) => void;
  onUseFieldMapping: (mapping: LoadSavedMappingItem) => void;
}

export const SaveMappingItem: FunctionComponent<SaveMappingItemProps> = ({ mapping, onButtonAction, onUseFieldMapping }) => {
  return (
    <div key={mapping.key}>
      <hr className="slds-m-vertical_xx-small" />
      <Grid vertical>
        <h4 className="slds-text-title_caps slds-line-clamp_x-small" title={mapping.name}>
          {mapping.name}
        </h4>
        <Grid align="spread" verticalAlign="end">
          <ul>
            <li>
              <Tooltip content={<TooltipContent mapping={mapping} />}>
                {formatNumber(mapping.csvFields.length)} Mapped {pluralizeIfMultiple('Field', mapping.csvFields)}
              </Tooltip>
            </li>
            <li>
              <span className="slds-truncate">
                {isDate(mapping.createdAt) ? formatDate(mapping.createdAt, DATE_FORMATS.YYYY_MM_DD_HH_mm_ss_a) : ''}
              </span>
            </li>
          </ul>
          <ButtonGroupContainer>
            {/* Every saved mapping repeats these controls — their names say which mapping they act on */}
            <button
              className="slds-button slds-button_neutral slds-button_first collapsible-button slds-m-left_x-small"
              aria-label={`Use mapping ${mapping.name}`}
              onClick={() => onUseFieldMapping(mapping)}
            >
              Use
            </button>
            <DropDown
              className="slds-button_last"
              dropDownClassName="slds-dropdown_actions"
              position="right"
              description={`Actions for mapping ${mapping.name}`}
              items={[{ id: 'delete', value: 'Delete', metadata: mapping }]}
              onSelected={onButtonAction}
            />
          </ButtonGroupContainer>
        </Grid>
      </Grid>
    </div>
  );
};

function getTargetField(item: Omit<FieldMappingItem, 'fieldMetadata'>): string {
  if (item.targetLookupField && item.relatedFieldMetadata && item.relationshipName === SELF_LOOKUP_KEY) {
    return `${item.selectedReferenceTo}.${item.relatedFieldMetadata.name}`;
  } else if (item.targetLookupField && item.relatedFieldMetadata) {
    return `${item.relationshipName}.${item.relatedFieldMetadata.name}`;
  } else {
    return item.targetField || '';
  }
}

const TooltipContent = ({ mapping }: { mapping: LoadSavedMappingItem }) => {
  // Keyed by mapping key rather than csvField, since one column can be mapped to multiple fields
  const items: [string, Omit<FieldMappingItem, 'fieldMetadata'>][] = Object.entries(mapping.mapping);
  const visibleItems = items.slice(0, 25);
  const remainingItems = items.length - visibleItems.length;
  return (
    <ul>
      {visibleItems.map(([mappingKey, item]) => (
        <li key={mappingKey}>
          <span>{isStaticValuePlaceholder(item.csvField) ? 'Manual value' : item.csvField}</span> {'->'} <span>{getTargetField(item)}</span>
        </li>
      ))}
      {items.length > visibleItems.length && <li>...{formatNumber(remainingItems)} more...</li>}
    </ul>
  );
};

export default SaveMappingItem;
