import { COMMON_METADATA_TYPES, DescribeMetadataList, getMetadataLabelFromFullName } from '@jetstream/connected-ui';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { CommonUser, SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, Grid, ReadonlyList } from '@jetstream/ui';
import { fromDeployMetadataState } from '@jetstream/ui-core';
import isBoolean from 'lodash/isBoolean';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { RadioButtonItem, RadioButtonSelection } from './RadioButtonSelection';

const METADATA_TYPES_RADIO_BUTTONS: RadioButtonItem<CommonUser>[] = [
  {
    name: 'user',
    label: 'Let Me Choose',
    value: 'user',
  },
  {
    name: 'common',
    label: 'Common Types',
    value: 'common',
  },
];

export interface MetadataSelectionProps {
  selectedOrg: SalesforceOrgUi;
  omitCommonTypes?: boolean;
  requireConfirmSelection?: boolean;
  onSubmit?: () => void;
}

export interface MetadataSelectionRequireSelection extends MetadataSelectionProps {
  requireConfirmSelection: true;
  onSubmit: () => void;
}

export const MetadataSelection: FunctionComponent<MetadataSelectionProps | MetadataSelectionRequireSelection> = ({
  selectedOrg,
  omitCommonTypes,
  requireConfirmSelection,
  onSubmit,
}) => {
  /** Store may get updated in tandem with local changes, but if requireConfirmSelection, then store will only get commits on submission */
  const [_metadataSelectionType, _setMetadataSelectionType] = useRecoilState<CommonUser>(
    fromDeployMetadataState.metadataSelectionTypeState
  );
  const [_metadataItems, _setMetadataItems] = useRecoilState(fromDeployMetadataState.metadataItemsState);
  const [_metadataItemsMap, _setMetadataItemsMap] = useRecoilState(fromDeployMetadataState.metadataItemsMapState);
  const [_selectedMetadataItems, _setSelectedMetadataItems] = useRecoilState(fromDeployMetadataState.selectedMetadataItemsState);

  const [metadataSelectionType, setMetadataSelectionType] = useState(_metadataSelectionType);
  const [metadataItems, setMetadataItems] = useState(_metadataItems);
  const [metadataItemsMap, setMetadataItemsMap] = useState(_metadataItemsMap);
  const [selectedMetadataItems, setSelectedMetadataItems] = useState(_selectedMetadataItems);

  useEffect(() => {
    if (!requireConfirmSelection) {
      _setMetadataSelectionType(metadataSelectionType);
    }
  }, [metadataSelectionType]);

  useEffect(() => {
    if (!requireConfirmSelection) {
      _setMetadataItems(metadataItems);
    }
  }, [metadataItems]);

  useEffect(() => {
    if (!requireConfirmSelection) {
      _setMetadataItemsMap(metadataItemsMap);
    }
  }, [metadataItemsMap]);

  useEffect(() => {
    if (!requireConfirmSelection) {
      _setSelectedMetadataItems(selectedMetadataItems);
    }
  }, [selectedMetadataItems]);

  useNonInitialEffect(() => {
    setMetadataItems(null);
    setMetadataItemsMap({});
    setSelectedMetadataItems(new Set());
  }, [selectedOrg]);

  function handleMetadataSelection(items: string[], options: { selectAllValue?: boolean; clearSelection?: boolean } = {}) {
    const { selectAllValue, clearSelection } = options;
    if (clearSelection) {
      setSelectedMetadataItems(new Set());
    } else {
      // add or remove all
      if (isBoolean(selectAllValue)) {
        if (selectAllValue) {
          setSelectedMetadataItems(new Set(Array.from(selectedMetadataItems).concat(items)));
        } else {
          const itemsToRemove = new Set(items);
          setSelectedMetadataItems(new Set(Array.from(selectedMetadataItems).filter((item) => !itemsToRemove.has(item))));
        }
      } else {
        // toggle each item - there should only be one item in items[]
        const existingItems = new Set(selectedMetadataItems);
        items.forEach((item) => {
          if (existingItems.has(item)) {
            existingItems.delete(item);
          } else {
            existingItems.add(item);
          }
        });
        setSelectedMetadataItems(existingItems);
      }
    }
  }

  function handleSubmit() {
    _setMetadataSelectionType(metadataSelectionType);
    _setMetadataItems(metadataItems);
    _setMetadataItemsMap(metadataItemsMap);
    _setSelectedMetadataItems(selectedMetadataItems);
    onSubmit && onSubmit();
  }

  return (
    <Fragment>
      {requireConfirmSelection && (
        <Grid align="center">
          <button className="slds-button slds-button_brand" onClick={handleSubmit} disabled={selectedMetadataItems.size === 0}>
            Submit
          </button>
        </Grid>
      )}
      {!omitCommonTypes && (
        <Fragment>
          <div className="slds-align_absolute-center">
            <RadioButtonSelection
              label={'Which Metadata types do you want to include?'}
              items={METADATA_TYPES_RADIO_BUTTONS}
              checkedValue={metadataSelectionType}
              disabled={false}
              onChange={(value) => setMetadataSelectionType(value as CommonUser)}
            />
          </div>
          <hr className="slds-m-vertical_small" />
          {metadataSelectionType === 'common' && (
            <AutoFullHeightContainer bottomBuffer={10}>
              <h2 className="slds-text-heading_medium slds-grow slds-text-align_center">Metadata Types</h2>
              <ReadonlyList
                items={COMMON_METADATA_TYPES}
                getContent={(item: string) => ({
                  key: item,
                  heading: getMetadataLabelFromFullName(item),
                  subheading: item,
                })}
              />
            </AutoFullHeightContainer>
          )}
        </Fragment>
      )}
      {(omitCommonTypes || metadataSelectionType === 'user') && (
        <DescribeMetadataList
          omitRefresh={requireConfirmSelection}
          inputLabelPlural="Metadata Types"
          org={selectedOrg}
          initialItems={metadataItems || []}
          initialItemMap={metadataItemsMap}
          selectedItems={selectedMetadataItems}
          onItems={setMetadataItems}
          onItemsMap={setMetadataItemsMap}
          onSelected={handleMetadataSelection}
        />
      )}
    </Fragment>
  );
};

export default MetadataSelection;
