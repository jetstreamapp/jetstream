import { COMMON_METADATA_TYPES, ListMetadataQueryExtended } from '@jetstream/connected-ui';
import { AllUser, ChangeSet, CommonUser, ListItem, MetadataObject, SalesforceUser, YesNo } from '@jetstream/types';
import { isAfter } from 'date-fns/isAfter';
import { isSameDay } from 'date-fns/isSameDay';
import { atom } from 'jotai';
import { atomWithReset } from 'jotai/utils';

export const metadataItemsState = atomWithReset<string[] | null>(null);

export const metadataItemsMapState = atomWithReset<Record<string, MetadataObject>>({});

export const selectedMetadataItemsState = atomWithReset(new Set<string>());

export const usersList = atomWithReset<ListItem<string, SalesforceUser>[] | null>(null);

export const metadataSelectionTypeState = atomWithReset<CommonUser>('user');

export const userSelectionState = atomWithReset<AllUser>('all');

export const dateRangeSelectionState = atomWithReset<AllUser>('all');

export const includeManagedPackageItems = atomWithReset<YesNo>('No');

export const dateRangeStartState = atomWithReset<Date | null>(null);

export const dateRangeEndState = atomWithReset<Date | null>(null);

export const selectedUsersState = atomWithReset<string[]>([]);

export const changesetPackage = atomWithReset<string>('');

export const changesetPackages = atomWithReset<ListItem<string, ChangeSet>[] | null>(null);

export const hasSelectionsMadeSelector = atom<boolean>((get) => {
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
});

export const hasSelectionsMadeMessageSelector = atom<string | null>((get) => {
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
});

export const listMetadataQueriesSelector = atom<ListMetadataQueryExtended[]>((get) => {
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
});

export const amplitudeSubmissionSelector = atom((get) => {
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
});
