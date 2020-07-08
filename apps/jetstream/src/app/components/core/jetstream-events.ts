import { Subject, Observable } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';
import { AsyncJob, AsyncJobNew } from '@jetstream/types';
import { logger } from '@jetstream/shared/client-logger';

export type JetstreamEventType = 'newJob' | 'jobFinished';
export type JetstreamEvents = JetstreamEventJobFinished | JetstreamEventNewJob;
export type JetstreamEventPayloads = AsyncJob | AsyncJobNew[];

export interface JetstreamEvent<T> {
  type: JetstreamEventType;
  payload: JetstreamEventPayloads;
}

export interface JetstreamEventNewJob extends JetstreamEvent<AsyncJobNew> {
  type: 'newJob';
  payload: AsyncJobNew[];
}

export interface JetstreamEventJobFinished extends JetstreamEvent<AsyncJob> {
  type: 'jobFinished';
  payload: AsyncJob;
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
