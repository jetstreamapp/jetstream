import { Maybe } from '@jetstream/types';
import { filter, Subject } from 'rxjs';

export type AppAction = AppActionViewRecord | AppActionEditRecord | AppActionCreateRecord | AppActionCloneRecord;
export type AppActionTypes =
  | AppActionViewRecord['action']
  | AppActionEditRecord['action']
  | AppActionCreateRecord['action']
  | AppActionCloneRecord['action'];

export type AppActionViewRecord = {
  action: 'VIEW_RECORD';
  payload: { recordId: string; objectName?: Maybe<string> };
};

export type AppActionEditRecord = {
  action: 'EDIT_RECORD';
  payload: { recordId: string; objectName?: Maybe<string> };
};

export type AppActionCreateRecord = {
  action: 'CREATE_RECORD';
  payload: { objectName: string };
};

export type AppActionCloneRecord = {
  action: 'CLONE_RECORD';
  payload: { recordId: string; objectName?: Maybe<string> };
};

export const appActionObservable = new Subject<AppAction>();
export const appActionObservable$ = appActionObservable.asObservable();

export const APP_ACTION_RECORD_EVENTS = new Set<AppActionTypes>(['EDIT_RECORD', 'VIEW_RECORD', 'CREATE_RECORD', 'CLONE_RECORD']);
export const appActionRecordEventFilter = filter<AppAction>((action) => APP_ACTION_RECORD_EVENTS.has(action.action));

export const recordActionModalClosedObservable = new Subject<{ objectName?: Maybe<string>; reloadRecords?: Maybe<boolean> }>();
export const recordActionModalClosedObservable$ = recordActionModalClosedObservable.asObservable();
