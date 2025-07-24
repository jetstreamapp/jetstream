import { CommonUser } from '@jetstream/types';
import { fromDeployMetadataState } from '@jetstream/ui-core';
import isBoolean from 'lodash/isBoolean';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useResetAtom } from 'jotai/utils';

export function useMetadataSelection() {
  const [metadataSelectionType, setMetadataSelectionType] = useAtom<CommonUser>(fromDeployMetadataState.metadataSelectionTypeState);
  const [metadataItems, setMetadataItems] = useAtom(fromDeployMetadataState.metadataItemsState);
  const [metadataItemsMap, setMetadataItemsMap] = useAtom(fromDeployMetadataState.metadataItemsMapState);
  const [selectedMetadataItems, setSelectedMetadataItems] = useAtom(fromDeployMetadataState.selectedMetadataItemsState);

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

  return {
    handleMetadataSelection,
    metadataItems,
    metadataItemsMap,
    metadataSelectionType,
    selectedMetadataItems,
    setMetadataItems,
    setMetadataItemsMap,
    setMetadataSelectionType,
  };
}
