import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { LoadSavedMappingItem } from '@jetstream/types';
import { BadgeNotification, EmptyState, fireToast, Icon, Popover, PopoverRef, Tooltip } from '@jetstream/ui';
import { STATIC_MAPPING_PREFIX } from '@jetstream/ui-core';
import { dexieDb } from '@jetstream/ui/db';
import classNames from 'classnames';
import { useLiveQuery } from 'dexie-react-hooks';
import { FunctionComponent, useRef } from 'react';
import LoadRecordsSaveMappingItem from './SaveMappingItem';

export interface LoadMappingPopoverProps {
  sobject: string;
  csvFields: Set<string>;
  objectFields: Set<string>;
  onLoadMapping: (mapping: LoadSavedMappingItem) => void;
}

export const LoadMappingPopover: FunctionComponent<LoadMappingPopoverProps> = ({ sobject, csvFields, objectFields, onLoadMapping }) => {
  const popoverRef = useRef<PopoverRef>(null);

  const savedMappingsForObject = useLiveQuery(
    () =>
      dexieDb.load_saved_mapping
        .where('sobject')
        .equalsIgnoreCase(sobject)
        .filter(
          (item) =>
            item.csvFields.filter((field) => !field.startsWith(STATIC_MAPPING_PREFIX)).every((field) => csvFields.has(field)) &&
            item.sobjectFields.every((field) => objectFields.has(field))
        )
        .toArray(),
    [sobject, csvFields, objectFields]
  );

  function onUseFieldMapping(mapping: LoadSavedMappingItem) {
    try {
      onLoadMapping(mapping);
      popoverRef.current?.close();
    } catch (ex) {
      logger.warn('Failed to load field mapping', ex);
      fireToast({
        type: 'error',
        message: 'Uh oh, there was a problem loading the field mapping. Please try again.',
      });
    }
  }

  function handleButtonAction(id: string, metadata: LoadSavedMappingItem) {
    try {
      if (id === 'delete' && metadata) {
        dexieDb.load_saved_mapping.where('key').equals(metadata.key).delete();
      }
    } catch (ex) {
      logger.warn('Failed to delete field mapping', ex);
      fireToast({
        type: 'error',
        message: 'Uh oh, there was a problem deleting the field mapping. Please try again.',
      });
    }
  }

  const hasSavedMappings = !!savedMappingsForObject?.length;

  return (
    <Popover
      ref={popoverRef}
      placement="bottom-end"
      bodyStyle={css`
        max-height: 70vh;
        overflow-y: auto;
      `}
      content={
        <>
          <h3 className="slds-text-heading_small slds-m-bottom_small">Load Field Mappings</h3>
          {!hasSavedMappings ? (
            <EmptyState
              headline="You don't have any saved field mappings for this object"
              subHeading="Your file must include all the headers from any saved mappings to be available for use."
              size="small"
            ></EmptyState>
          ) : (
            <div className="slds-p-bottom_xx-large">
              The following mappings are available based on your selected object and input file headers.
              {savedMappingsForObject.map((mapping) => (
                <LoadRecordsSaveMappingItem
                  key={mapping.key}
                  mapping={mapping}
                  onButtonAction={handleButtonAction}
                  onUseFieldMapping={onUseFieldMapping}
                />
              ))}
            </div>
          )}
        </>
      }
      buttonProps={{
        className: 'slds-dropdown-trigger slds-dropdown-trigger_click cursor-pointer',
        as: 'div',
      }}
    >
      <Tooltip content={'Load field mapping'}>
        <button
          className={classNames('slds-dropdown-trigger slds-dropdown-trigger_click slds-button slds-button_neutral slds-button_last', {
            'slds-incoming-notification': savedMappingsForObject?.length,
          })}
        >
          <Icon type="utility" icon="open" className="slds-button__icon slds-button__icon_left" omitContainer />
          Load
        </button>
        {hasSavedMappings && <BadgeNotification>{savedMappingsForObject.length}</BadgeNotification>}
      </Tooltip>
    </Popover>
  );
};

export default LoadMappingPopover;
