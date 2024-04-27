import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
import { createDebugLevel, createOrExtendDebugTrace, getDebugLevelQuery, getTraceFlagQuery } from '@jetstream/shared/ui-utils';
import { DebugLevel, SalesforceOrgUi, UserTrace } from '@jetstream/types';
import { addMinutes } from 'date-fns/addMinutes';
import { differenceInMilliseconds } from 'date-fns/differenceInMilliseconds';
import { isBefore } from 'date-fns/isBefore';
import { parseISO } from 'date-fns/parseISO';
import { useCallback, useEffect, useReducer, useRef } from 'react';

/**
 * This hook does the following:
 * Fetch debug log levels -> create one if none exist
 * Find one to set as active
 * Fetch user trace
 *  -> Extend it if it exists
 *  -> Create it if not exists
 * Once trace is going to expire, if component is still mounted, then it will be extended
 */

const DEFAULT_EXTEND_TRACE_BY_HOURS = 3;
const BUFFER_TO_EXTEND_MINUTES = 20;

type Action =
  | { type: 'INIT' }
  /** Payload only required if setting to false (E.x. exception in process, disable loading) */
  | { type: 'LOADING'; payload?: { loading: boolean } }
  | { type: 'EXTENDED_TRACE'; payload: { userTrace: UserTrace; expirationDate: Date } }
  | { type: 'CHANGE_DEBUG_LEVEL'; payload: { userTrace: UserTrace; expirationDate: Date; debugLevel: DebugLevel } }
  | {
      type: 'SUCCESS';
      payload: {
        userTrace: UserTrace;
        debugLevels: DebugLevel[];
        activeDebugLevel: DebugLevel;
        expirationDate: Date;
      };
    }
  | { type: 'ERROR'; payload: { errorMessage: string } };

interface State {
  hasLoaded: boolean;
  loading: boolean;
  errorMessage?: string | null;
  status: 'INIT' | 'EXTENDING' | 'IDLE' | 'ERROR';
  userTrace?: UserTrace;
  debugLevels?: DebugLevel[];
  activeDebugLevel?: DebugLevel;
  expirationDate?: Date;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'INIT':
      return {
        hasLoaded: true,
        loading: true,
        errorMessage: null,
        status: 'INIT',
      };
    case 'LOADING':
      return { ...state, loading: action.payload?.loading ?? true };
    case 'EXTENDED_TRACE':
      return { ...state, loading: false, ...action.payload };
    case 'CHANGE_DEBUG_LEVEL':
      return { ...state, loading: false, activeDebugLevel: action.payload.debugLevel };
    case 'SUCCESS':
      return { hasLoaded: true, loading: false, status: 'IDLE', ...action.payload };
    case 'ERROR':
      return { ...state, hasLoaded: true, loading: false, status: 'ERROR', errorMessage: action.payload.errorMessage };
    default:
      throw new Error('Invalid action');
  }
}

export function useSetTraceFlag(org: SalesforceOrgUi, extendTraceHours = DEFAULT_EXTEND_TRACE_BY_HOURS) {
  const isMounted = useRef(true);
  const expirationTimeout = useRef<number>();

  const [{ hasLoaded, loading, errorMessage, status, userTrace, debugLevels, activeDebugLevel, expirationDate }, dispatch] = useReducer(
    reducer,
    {
      hasLoaded: false,
      loading: false,
      status: 'IDLE',
    }
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      clearTimeout(expirationTimeout.current);
    };
  }, []);

  useEffect(() => {
    dispatch({ type: 'INIT' });
    init();
  }, [org]);

  useEffect(() => {
    if (expirationDate && activeDebugLevel?.Id && userTrace) {
      extendExpirationBeforeExpire(expirationDate, activeDebugLevel.Id, userTrace);
    }
  }, [expirationDate, activeDebugLevel, userTrace]);

  /**
   * Change debug log level and update trace to use new level
   */
  async function changeLogLevel(debugLevel: DebugLevel) {
    try {
      dispatch({ type: 'LOADING' });
      const { expirationDate, trace } = await createOrExtendDebugTrace(org, extendTraceHours, debugLevel.Id, userTrace);
      if (isMounted.current) {
        dispatch({ type: 'CHANGE_DEBUG_LEVEL', payload: { userTrace: trace, expirationDate, debugLevel } });
      }
    } catch (ex) {
      logger.error('[APEX LOG][CHANGE LEVEL][ERROR]', ex.message);
      if (isMounted.current) {
        dispatch({ type: 'LOADING', payload: { loading: false } });
      }
    }
  }

  const init = useCallback(async () => {
    try {
      const { queryResults: debugLevelResults } = await query<DebugLevel>(org, getDebugLevelQuery(), true);
      const { queryResults: traceResults } = await query<UserTrace>(org, getTraceFlagQuery(org.userId), true);

      if (isMounted.current) {
        let newExpirationDate;
        let debugLevels = debugLevelResults.records;
        let activeDebugLevel =
          debugLevels.find(
            (item) => item.DeveloperName.toLowerCase() === 'sfdc_devconsole' || item.DeveloperName.toLowerCase().includes('DEBUG')
          ) || debugLevels[0];
        let userTrace = traceResults.records[0];

        if (!debugLevels.length) {
          activeDebugLevel = await createDebugLevel(org);
          debugLevels = [activeDebugLevel];
        }

        if (!userTrace) {
          // trace does not exist, create
          const results = await createOrExtendDebugTrace(org, extendTraceHours, activeDebugLevel.Id);
          userTrace = results.trace;
          newExpirationDate = results.expirationDate;
        } else {
          newExpirationDate = parseISO(userTrace.ExpirationDate);
          // Trace is expired, extend
          if (isBefore(newExpirationDate, new Date())) {
            const results = await createOrExtendDebugTrace(org, extendTraceHours, activeDebugLevel.Id, userTrace);
            userTrace = results.trace;
            newExpirationDate = results.expirationDate;
          }
        }
        dispatch({
          type: 'SUCCESS',
          payload: {
            userTrace,
            debugLevels: debugLevels,
            activeDebugLevel: activeDebugLevel,
            expirationDate: newExpirationDate,
          },
        });
      }
    } catch (ex) {
      logger.error('[APEX LOG][TRACE][ERROR]', ex.message);
      logger.error(ex.stack);
      dispatch({
        type: 'ERROR',
        payload: {
          errorMessage: ex.message,
        },
      });
    }
  }, [org, extendTraceHours]);

  /**
   * Sets a timeout to extend the user trace if the user is still on the page when the
   */
  const extendExpirationBeforeExpire = useCallback(
    (expirationDate: Date, activeDebugLevelId: string, userTrace: UserTrace) => {
      if (expirationTimeout.current) {
        clearTimeout(expirationTimeout.current);
      }

      // get milliseconds until we are close to expiring - ensure that it is at least 1 hour in the future
      const needToRefreshTrace = Math.max(
        60000,
        differenceInMilliseconds(addMinutes(expirationDate, BUFFER_TO_EXTEND_MINUTES * -1), new Date())
      );

      logger.log('[APEX LOG][REFRESH TRACE MS]', needToRefreshTrace);

      expirationTimeout.current = window.setTimeout(async () => {
        logger.log('[APEX LOG][REFRESHING TRACE]');
        if (isMounted.current) {
          try {
            dispatch({ type: 'LOADING' });
            const results = await createOrExtendDebugTrace(org, extendTraceHours, activeDebugLevelId, userTrace);
            if (isMounted.current) {
              dispatch({
                type: 'EXTENDED_TRACE',
                payload: {
                  userTrace: results.trace,
                  expirationDate: results.expirationDate,
                },
              });
            }
          } catch (ex) {
            // could not extend
            logger.warn('[APEX LOG][TRACE EXTEND ERROR]', ex.message);
            logger.warn(ex);
            if (isMounted.current) {
              dispatch({ type: 'LOADING', payload: { loading: false } });
            }
          }
        }
      }, needToRefreshTrace);
      return () => {
        clearTimeout(expirationTimeout.current);
      };
    },
    [org, extendTraceHours]
  );

  return { changeLogLevel, hasLoaded, loading, errorMessage, status, userTrace, activeDebugLevel, debugLevels, expirationDate };
}
