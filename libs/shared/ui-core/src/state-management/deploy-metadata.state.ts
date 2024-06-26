import { COMMON_METADATA_TYPES, ListMetadataQueryExtended } from '@jetstream/connected-ui';
import { AllUser, ChangeSet, CommonUser, ListItem, MetadataObject, SalesforceUser, YesNo } from '@jetstream/types';
import { isAfter } from 'date-fns/isAfter';
import { isSameDay } from 'date-fns/isSameDay';
import { atom, selector } from 'recoil';

export const metadataItemsState = atom<string[] | null>({
  key: 'deploy-metadata.metadataItemsState',
  default: null,
});

export const metadataItemsMapState = atom<Record<string, MetadataObject>>({
  key: 'deploy-metadata.metadataItemsMapState',
  default: {},
});

export const selectedMetadataItemsState = atom<Set<string>>({
  key: 'deploy-metadata.selectedMetadataItemsState',
  default: new Set(),
});

export const usersList = atom<ListItem<string, SalesforceUser>[] | null>({
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

export const includeManagedPackageItems = atom<YesNo>({
  key: 'deploy-metadata.includeManagedPackageItems',
  default: 'No',
});

export const dateRangeStartState = atom<Date | null>({
  key: 'deploy-metadata.dateRangeStartState',
  default: null,
});

export const dateRangeEndState = atom<Date | null>({
  key: 'deploy-metadata.dateRangeEndState',
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

export const changesetPackages = atom<ListItem<string, ChangeSet>[] | null>({
  key: 'deploy-metadata.changesetPackages',
  default: null,
});

export const hasSelectionsMadeSelector = selector<boolean>({
  key: 'deploy-metadata.hasSelectionsMadeSelector',
  get: ({ get }) => {
    const metadataSelectionType = get(metadataSelectionTypeState);
    const userSelection = get(userSelectionState);
    const dateRangeSelection = get(dateRangeSelectionState);
    const dateStartRange = get(dateRangeStartState);
    const dateEndRange = get(dateRangeEndState);
    const selectedMetadataItems = get(selectedMetadataItemsState);
    const selectedUsers = get(selectedUsersState);

    if (metadataSelectionType === 'user' && selectedMetadataItems.size === 0) {
      return false;
    } else if (userSelection === 'user' && selectedUsers.length === 0) {
      return false;
    } else if (dateRangeSelection === 'user' && !dateStartRange && !dateEndRange) {
      return false;
    } else if (
      dateRangeSelection === 'user' &&
      dateStartRange &&
      dateEndRange &&
      (isSameDay(dateStartRange, dateEndRange) || isAfter(dateStartRange, dateEndRange))
    ) {
      return false;
    }
    return true;
  },
});

export const hasSelectionsMadeMessageSelector = selector<string | null>({
  key: 'deploy-metadata.hasSelectionsMadeMessageSelector',
  get: ({ get }) => {
    const metadataSelectionType = get(metadataSelectionTypeState);
    const userSelection = get(userSelectionState);
    const dateRangeSelection = get(dateRangeSelectionState);
    const dateStartRange = get(dateRangeStartState);
    const dateEndRange = get(dateRangeEndState);
    const selectedMetadataItems = get(selectedMetadataItemsState);
    const selectedUsers = get(selectedUsersState);

    if (metadataSelectionType === 'user' && selectedMetadataItems.size === 0) {
      return 'Choose one or more metadata types';
    } else if (userSelection === 'user' && selectedUsers.length === 0) {
      return 'Choose one or more users or select All Users';
    } else if (dateRangeSelection === 'user' && !dateStartRange && !dateEndRange) {
      return 'Choose a last modified start and/or end date or select Any Date';
    } else if (
      dateRangeSelection === 'user' &&
      dateStartRange &&
      dateEndRange &&
      (isSameDay(dateStartRange, dateEndRange) || isAfter(dateStartRange, dateEndRange))
    ) {
      return 'The start date must be before the end date';
    } else {
      return 'Continue to select the metadata components to deploy';
    }
  },
});

export const listMetadataQueriesSelector = selector<ListMetadataQueryExtended[]>({
  key: 'deploy-metadata.listMetadataQueriesSelector',
  get: ({ get }) => {
    const metadataSelectionType = get(metadataSelectionTypeState);
    const metadataItemsMap = get(metadataItemsMapState);
    const selectedMetadataItems = get(selectedMetadataItemsState);
    return (metadataSelectionType === 'common' ? COMMON_METADATA_TYPES : Array.from(selectedMetadataItems))
      .filter((item) => metadataItemsMap[item])
      .map((item): ListMetadataQueryExtended => {
        const metadataDescribe = metadataItemsMap[item];
        return {
          type: metadataDescribe.xmlName,
          folder: undefined,
          inFolder: metadataDescribe.inFolder,
        };
      });
  },
});

export const amplitudeSubmissionSelector = selector({
  key: 'deploy-metadata.amplitudeSubmissionSelector',
  get: ({ get }) => {
    const metadataSelectionType = get(metadataSelectionTypeState);
    const userSelection = get(userSelectionState);
    const dateRangeSelection = get(dateRangeSelectionState);
    const dateStartRange = get(dateRangeStartState);
    const dateEndRange = get(dateRangeEndState);
    const selectedMetadataItems = get(selectedMetadataItemsState);
    const selectedUsers = get(selectedUsersState);
    const includeManaged = get(includeManagedPackageItems);

    return {
      metadataCount: selectedMetadataItems.size,
      metadataSelectionType: metadataSelectionType,
      userSelection: userSelection,
      selectedUserCount: selectedUsers.length,
      dateRangeSelection: dateRangeSelection,
      dateStartRange: dateStartRange,
      dateEndRange: dateEndRange,
      includeManaged: includeManaged === 'Yes',
    };
  },
});
