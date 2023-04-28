import { DATE_FORMATS } from '@jetstream/shared/constants';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeIfMultiple } from '@jetstream/shared/utils';
import { ButtonGroupContainer, DropDown, Grid, Tooltip } from '@jetstream/ui';
import formatDate from 'date-fns/format';
import { FunctionComponent } from 'react';
import { FieldMappingItem } from '../../load-records-types';
import { LoadSavedMappingItem } from '../../load-records.state';
import { SELF_LOOKUP_KEY } from '../../utils/load-records-utils';

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
              <span className="slds-truncate">{formatDate(mapping.createdDate, DATE_FORMATS.YYYY_MM_DD_HH_mm_ss_a)}</span>
            </li>
          </ul>
          <ButtonGroupContainer>
            <button
              className="slds-button slds-button_neutral slds-button_first collapsible-button slds-m-left_x-small"
              onClick={() => onUseFieldMapping(mapping)}
            >
              Use
            </button>
            <DropDown
              className="slds-button_last"
              dropDownClassName="slds-dropdown_actions"
              position="right"
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
  const items = Object.values(mapping.mapping);
  const visibleItems = items.slice(0, 25);
  const remainingItems = items.length - visibleItems.length;
  return (
    <ul>
      {visibleItems.map((item) => (
        <li key={item.csvField}>
          <span>{item.csvField}</span> {'->'} <span>{getTargetField(item)}</span>
        </li>
      ))}
      {items.length > visibleItems.length && <li>...{formatNumber(remainingItems)} more...</li>}
    </ul>
  );
};

export default SaveMappingItem;
