import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { BadgeNotification, EmptyState, Icon, Popover, PopoverRef, Tooltip, fireToast } from '@jetstream/ui';
import { fromLoadRecordsState } from '@jetstream/ui-core';
import classNames from 'classnames';
import pickBy from 'lodash/pickBy';
import { FunctionComponent, useRef } from 'react';
import { useRecoilValue, useSetRecoilState } from 'recoil';
import LoadRecordsSaveMappingItem from './SaveMappingItem';

export interface LoadMappingPopoverProps {
  sobject: string;
  csvFields: Set<string>;
  objectFields: Set<string>;
  onLoadMapping: (mapping: fromLoadRecordsState.LoadSavedMappingItem) => void;
}

export const LoadMappingPopover: FunctionComponent<LoadMappingPopoverProps> = ({ sobject, csvFields, objectFields, onLoadMapping }) => {
  const popoverRef = useRef<PopoverRef>(null);
  const setFieldMappingState = useSetRecoilState(fromLoadRecordsState.savedFieldMappingState);
  const savedMappingsForObject = useRecoilValue(fromLoadRecordsState.selectSavedFieldMappingState({ sobject, csvFields, objectFields }));

  function onUseFieldMapping(mapping: fromLoadRecordsState.LoadSavedMappingItem) {
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

  function handleButtonAction(id: string, metadata: fromLoadRecordsState.LoadSavedMappingItem) {
    if (id === 'delete' && metadata) {
      setFieldMappingState((prevItems) => ({
        ...prevItems,
        [sobject]: {
          ...pickBy(prevItems[sobject] || {}, (item) => item.key !== metadata.key),
        },
      }));
    }
  }

  const hasSavedMappings = savedMappingsForObject.length > 0;

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
            'slds-incoming-notification': savedMappingsForObject.length,
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
