import { COMMON_METADATA_TYPES, ListMetadataQueryExtended } from '@jetstream/connected-ui';
import { ListItem, MapOf } from '@jetstream/types';
import { MetadataObject } from 'jsforce';
import { atom, selector } from 'recoil';
import { AllUser, ChangeSetPackage, CommonUser, SalesforceUser } from './deploy-metadata.types';

export const metadataItemsState = atom<string[]>({
  key: 'deploy-metadata.metadataItemsState',
  default: null,
});

export const metadataItemsMapState = atom<MapOf<MetadataObject>>({
  key: 'deploy-metadata.metadataItemsMapState',
  default: {},
});

export const selectedMetadataItemsState = atom<Set<string>>({
  key: 'deploy-metadata.selectedMetadataItemsState',
  default: new Set(),
});

export const usersList = atom<ListItem<string, SalesforceUser>[]>({
  key: 'deploy-metadata.usersList',
  default: null,
});

export const metadataSelectionTypeState = atom<CommonUser>({
  key: 'deploy-metadata.metadataSelectionTypeState',
  default: 'user',
});

export const userSelectionState = atom<AllUser>({
  key: 'deploy-metadata.userSelectionState',
  default: 'all',
});

export const dateRangeSelectionState = atom<AllUser>({
  key: 'deploy-metadata.dateRangeSelectionState',
  default: 'all',
});

export const dateRangeState = atom<Date>({
  key: 'deploy-metadata.dateRangeState',
  default: null,
});

export const selectedUsersState = atom<string[]>({
  key: 'deploy-metadata.selectedUsersState',
  default: [],
});

export const changesetPackage = atom<string>({
  key: 'deploy-metadata.changesetPackage',
  default: '',
});

export const changesetPackages = atom<ListItem<string, ChangeSetPackage>[]>({
  key: 'deploy-metadata.changesetPackages',
  default: null,
});

export const hasSelectionsMadeSelector = selector<boolean>({
  key: 'deploy-metadata.hasSelectionsMadeSelector',
  get: ({ get }) => {
    const metadataSelectionType = get(metadataSelectionTypeState);
    const userSelection = get(userSelectionState);
    const dateRangeSelection = get(dateRangeSelectionState);
    const dateRange = get(dateRangeState);
    const selectedMetadataItems = get(selectedMetadataItemsState);
    const selectedUsers = get(selectedUsersState);

    if (metadataSelectionType === 'user' && selectedMetadataItems.size === 0) {
      return false;
    } else if (userSelection === 'user' && selectedUsers.length === 0) {
      return false;
    } else if (dateRangeSelection === 'user' && !dateRange) {
      return false;
    }

    return true;
  },
});

export const listMetadataQueriesSelector = selector<ListMetadataQueryExtended[]>({
  key: 'deploy-metadata.listMetadataQueriesSelector',
  get: ({ get }) => {
    const metadataSelectionType = get(metadataSelectionTypeState);
    const metadataItemsMap = get(metadataItemsMapState);
    const selectedMetadataItems = get(selectedMetadataItemsState);
    return (metadataSelectionType === 'common' ? COMMON_METADATA_TYPES : Array.from(selectedMetadataItems)).map(
      (item): ListMetadataQueryExtended => {
        const metadataDescribe = metadataItemsMap[item];
        return {
          type: metadataDescribe.xmlName,
          folder: null,
          inFolder: metadataDescribe.inFolder,
        };
      }
    );
  },
});
