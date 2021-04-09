import { logger } from '@jetstream/shared/client-logger';
import { AsyncJob, AsyncJobNew, SalesforceOrgUi } from '@jetstream/types';
import { Observable, Subject } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';

export type JetstreamEventType = 'newJob' | 'jobFinished' | 'lastActivityUpdate' | 'addOrg';
export type JetstreamEvents = JetstreamEventJobFinished | JetstreamEventLastActivityUpdate | JetstreamEventNewJob | JetstreamEventAddOrg;
export interface JetstreamEventAddOrgPayload {
  org: SalesforceOrgUi;
  replaceOrgUniqueId?: string;
}
export type JetstreamEventPayloads = AsyncJob | AsyncJobNew[] | JetstreamEventAddOrgPayload;

export interface JetstreamEvent<T> {
  type: JetstreamEventType;
  payload: T;
}

export interface JetstreamEventNewJob extends JetstreamEvent<JetstreamEventPayloads> {
  type: 'newJob';
  payload: AsyncJobNew[];
}

export interface JetstreamEventLastActivityUpdate extends JetstreamEvent<JetstreamEventPayloads> {
  type: 'lastActivityUpdate';
  payload: AsyncJob;
}

export interface JetstreamEventJobFinished extends JetstreamEvent<JetstreamEventPayloads> {
  type: 'jobFinished';
  payload: AsyncJob;
}

export interface JetstreamEventAddOrg extends JetstreamEvent<JetstreamEventPayloads> {
  type: 'addOrg';
  payload: JetstreamEventAddOrgPayload;
}

const jetstreamEvent = new Subject<JetstreamEvents>();
const jetstreamEvent$ = jetstreamEvent.asObservable();

export function getObservable(type: JetstreamEventType): Observable<JetstreamEventPayloads> {
  return jetstreamEvent$.pipe(
    tap((ev) => logger.info('[jetstreamEvent]', ev)),
    filter((ev) => ev.type === type),
    map((ev) => ev.payload)
  );
}

export function emit(event: JetstreamEvents) {
  jetstreamEvent.next(event);
}
