import { QueryHistorySelection, QueryHistoryItem, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { atom, selector } from 'recoil';
import { orderObjectsBy, REGEX } from '@jetstream/shared/utils';
import localforage from 'localforage';
import { INDEXED_DB } from '@jetstream/shared/constants';
import * as fromAppState from '../../../app-state';
import orderBy from 'lodash/orderBy';
import { describeSObject } from '@jetstream/shared/data';

const defaultSelectedObject: QueryHistorySelection = {
  key: 'all',
  name: 'all',
  label: 'All Objects',
};

function initQueryHistory(): Promise<MapOf<QueryHistoryItem>> {
  return localforage.getItem<MapOf<QueryHistoryItem>>(INDEXED_DB.KEYS.queryHistory);
}

// FIXME: there is some really poor naming conventions surrounding the entire query history

/**
 * Get new history item to save
 * If we do not know the label of the object, then we go fetch it
 */
export async function getQueryHistoryItem(
  org: SalesforceOrgUi,
  soql: string,
  sObject: string,
  sObjectLabel?: string
): Promise<QueryHistoryItem> {
  if (!sObjectLabel) {
    const resultsWithCache = await describeSObject(org, sObject);
    const results = resultsWithCache.data;
    sObjectLabel = results.name;
  }
  const queryHistoryItem: QueryHistoryItem = {
    key: `${org.uniqueId}:${sObject}${soql.replace(REGEX.NOT_ALPHANUMERIC_OR_UNDERSCORE, '')}`,
    label: sObjectLabel,
    soql,
    org: org.uniqueId,
    runCount: 1,
    sObject,
    lastRun: new Date(),
    created: new Date(),
  };
  return queryHistoryItem;
}

export const selectedObjectState = atom<string>({
  key: 'queryHistory.queryHistorySelectedObject',
  default: 'all',
});

// selectedOrgState

export const queryHistoryState = atom<MapOf<QueryHistoryItem>>({
  key: 'queryHistory.queryHistoryState',
  default: initQueryHistory(),
});

export const selectQueryHistoryForOrg = selector({
  key: 'queryHistory.selectQueryHistoryForOrg',
  get: ({ get }) => {
    const queryHistoryItems = get(queryHistoryState);
    const selectedOrg = get(fromAppState.selectedOrgState);
    if (!selectedOrg || !queryHistoryItems) {
      return [];
    }
    return Object.values(queryHistoryItems).filter((item) => item.org === selectedOrg.uniqueId);
  },
});

export const selectQueryHistoryState = selector({
  key: 'queryHistory.selectQueryHistoryState',
  get: ({ get }) => {
    const queryHistoryItems = get(selectQueryHistoryForOrg);
    const selectedObject = get(selectedObjectState);
    return orderBy(
      queryHistoryItems.filter((item) => {
        if (selectedObject === 'all') {
          return true;
        }
        return item.sObject === selectedObject;
      }),
      ['lastRun'],
      ['desc']
    );
  },
});

/**
 * Get list of all objects for org, in order by label
 */
export const selectObjectsList = selector<QueryHistorySelection[]>({
  key: 'queryHistory.selectObjectsList',
  get: ({ get }) => {
    const queryHistoryItems = get(selectQueryHistoryForOrg);
    const objectList = Object.values(
      queryHistoryItems.reduce((items: MapOf<QueryHistorySelection>, item) => {
        items[item.sObject] = {
          key: item.sObject,
          name: item.sObject,
          label: item.label,
        };
        return items;
      }, {})
    );

    return [defaultSelectedObject].concat(orderObjectsBy(objectList, 'label'));
  },
});
