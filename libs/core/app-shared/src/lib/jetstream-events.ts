import { logger } from '@jetstream/shared/client-logger';
import { JetstreamEventPayloads, JetstreamEvents, JetstreamEventType } from '@jetstream/types';
import { Observable, Subject } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';

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
