import { filter, Subject } from 'rxjs';

export type AppAction = AppActionViewRecord | AppActionEditRecord;
export type AppActionTypes = AppActionViewRecord['action'] | AppActionEditRecord['action'];

export type AppActionViewRecord = {
  action: 'VIEW_RECORD';
  payload: { recordId: string };
};

export type AppActionEditRecord = {
  action: 'EDIT_RECORD';
  payload: { recordId: string };
};

export const appActionObservable = new Subject<AppAction>();
export const appActionObservable$ = appActionObservable.asObservable();

export const APP_ACTION_RECORD_EVENTS = new Set<AppActionViewRecord['action'] | AppActionEditRecord['action']>([
  'EDIT_RECORD',
  'VIEW_RECORD',
]);
export const appActionRecordEventFilter = filter<AppAction>((action) => APP_ACTION_RECORD_EVENTS.has(action.action));
