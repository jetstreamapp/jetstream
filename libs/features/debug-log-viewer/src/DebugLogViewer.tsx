import { css } from '@emotion/react';
import { MIME_TYPES, TITLES } from '@jetstream/shared/constants';
import { fetchActiveLog, saveFile, useNonInitialEffect, useObservable, useTitle } from '@jetstream/shared/ui-utils';
import { SplitWrapper as Split } from '@jetstream/splitjs';
import { ApexLogWithViewed, SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  Card,
  Checkbox,
  CopyToClipboard,
  Grid,
  Icon,
  SalesforceLogin,
  Spinner,
  Tooltip,
  ViewDocsLink,
  dataTableFileSizeFormatter,
} from '@jetstream/ui';
import {
  RequireMetadataApiBanner,
  applicationCookieState,
  fromJetstreamEvents,
  isAsyncJob,
  selectSkipFrontdoorAuth,
  selectedOrgState,
} from '@jetstream/ui-core';
import Editor from '@monaco-editor/react';
import classNames from 'classnames';
import { formatDate } from 'date-fns/format';
import escapeRegExp from 'lodash/escapeRegExp';
import type { editor } from 'monaco-editor';
import { Fragment, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { filter } from 'rxjs/operators';
import DebugLogViewerFilter from './DebugLogViewerFilter';
import DebugLogViewerTable from './DebugLogViewerTable';
import DebugLogViewerTrace from './DebugLogViewerTrace';
import PurgeLogsModal from './PurgeLogsModal';
import { useDebugLogs } from './useDebugLogs';

const USER_DEBUG_REGEX = /\|USER_DEBUG\|/;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DebugLogViewerProps {}

export const DebugLogViewer: FunctionComponent<DebugLogViewerProps> = () => {
  useTitle(TITLES.DEBUG_LOGS);
  const isMounted = useRef(true);
  const logCache = useRef<Record<string, string>>({});
  const logRef = useRef<editor.IStandaloneCodeEditor>();
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const skipFrontDoorAuth = useRecoilValue(selectSkipFrontdoorAuth);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const [showLogsFromAllUsers, setShowLogsFromAllUsers] = useState(false);
  const [loadingLog, setLoadingLog] = useState(false);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [activeLog, setActiveLog] = useState<string>('');
  const [userDebug, setUserDebug] = useState(false);
  const [textFilter, setTextFilter] = useState<string>('');
  const [visibleResults, setVisibleResults] = useState<string>('');
  const activeOrgId = useRef(selectedOrg.uniqueId);
  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const bulkDeleteJob = useObservable(
    fromJetstreamEvents.getObservable('jobFinished').pipe(filter((ev) => isAsyncJob(ev) && ev.type === 'BulkDelete'))
  );

  const { togglePause, fetchLogs, isPaused, loading, lastChecked, logs, pollInterval } = useDebugLogs(selectedOrg, {
    limit: showLogsFromAllUsers ? 200 : 100,
    userId: showLogsFromAllUsers ? undefined : selectedOrg.userId,
  });
  const [pollTitle] = useState(() => `Checking for new logs every ${pollInterval / 1000} seconds`);

  /** Logs that get updated with viewed=true flag after viewing */
  const [logsWithViewedFlag, setLogsWithViewedFlag] = useState<ApexLogWithViewed[]>(() =>
    logs.map((log) => ({
      ...log,
      LogLength: dataTableFileSizeFormatter(log.LogLength),
      viewed: !!logCache.current[log.Id],
      'LogUser.Id': log.LogUser.Id,
      'LogUser.Name': log.LogUser.Name,
      'LogUser.Username': log.LogUser.Username,
    }))
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (bulkDeleteJob) {
      fetchLogs(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bulkDeleteJob]);

  useNonInitialEffect(() => {
    logCache.current = {};
    activeOrgId.current = selectedOrg.uniqueId;
    setActiveLogId(null);
    setTextFilter('');
    setVisibleResults('');
    setTextFilter('');
    setUserDebug(false);
    setShowLogsFromAllUsers(false);
  }, [selectedOrg]);

  useEffect(() => {
    updateLogsWithViewedFlag();
  }, [logs]);

  useEffect(() => {
    fetchLogs();
  }, [showLogsFromAllUsers]);

  useEffect(() => {
    setVisibleResults(activeLog || '');
  }, [activeLog]);

  useEffect(() => {
    let currResults = activeLog.split('\n');
    // remove non user-debug lines
    if (userDebug && currResults) {
      currResults = currResults.filter((line) => USER_DEBUG_REGEX.test(line));
    }
    // apply text filter
    if (textFilter && activeLog) {
      const textFilterRegex = new RegExp(escapeRegExp(textFilter), 'i');
      currResults = currResults.filter((line) => textFilterRegex.test(line));
    }
    setVisibleResults(currResults.join('\n'));
  }, [activeLog, userDebug, textFilter]);

  const updateLogsWithViewedFlag = useCallback(() => {
    setLogsWithViewedFlag(
      logs.map((log) => ({
        ...log,
        LogLength: dataTableFileSizeFormatter(log.LogLength),
        viewed: !!logCache.current[log.Id],
        'LogUser.Id': log.LogUser.Id,
        'LogUser.Name': log.LogUser.Name,
        'LogUser.Username': log.LogUser.Username,
      }))
    );
  }, [logs]);

  const getActiveLog = useCallback(async () => {
    try {
      if (!activeLogId) {
        return;
      }
      if (logCache.current[activeLogId]) {
        setActiveLog(logCache.current[activeLogId]);
        return;
      }
      const orgId = selectedOrg.uniqueId;
      setLoadingLog(true);
      const results = await fetchActiveLog(selectedOrg, activeLogId);
      if (isMounted.current) {
        setActiveLog(results);
        // save log in local cache
        if (activeOrgId.current === orgId) {
          logCache.current = { ...logCache.current, [activeLogId]: results };
          updateLogsWithViewedFlag();
        }
      }
    } catch (ex) {
      // TODO: handle error state
    } finally {
      if (isMounted.current) {
        setLoadingLog(false);
      }
    }
  }, [selectedOrg, activeLogId]);

  useNonInitialEffect(() => {
    if (activeLogId) {
      getActiveLog();
    }
  }, [activeLogId]);

  function handleLogEditorMount(ed: editor.IStandaloneCodeEditor) {
    logRef.current = ed;
  }

  function handleActiveLogChange(log: ApexLogWithViewed) {
    setActiveLogId(log.Id);
    setTextFilter('');
    setUserDebug(false);
  }

  function downloadActiveLog() {
    if (activeLog && !loadingLog) {
      saveFile(activeLog, `log-${activeLogId}.log`, MIME_TYPES.PLAN_TEXT);
    }
  }

  return (
    <AutoFullHeightContainer fillHeight bottomBuffer={10} setHeightAttr className="slds-p-horizontal_x-small slds-scrollable_none">
      <RequireMetadataApiBanner />
      {purgeModalOpen && <PurgeLogsModal selectedOrg={selectedOrg} onModalClose={() => setPurgeModalOpen(false)} />}
      <Split
        sizes={[66, 33]}
        minSize={[300, 300]}
        gutterSize={10}
        className="slds-gutters"
        css={css`
          display: flex;
          flex-direction: row;
        `}
      >
        <div className="slds-p-horizontal_x-small">
          <Card
            className="h-100"
            icon={{ type: 'standard', icon: 'feed' }}
            title={
              <Grid vertical>
                <div>Debug Logs</div>
                <ViewDocsLink textReset path="/developer/debug-logs" />
              </Grid>
            }
            actions={
              <Fragment>
                <DebugLogViewerTrace org={selectedOrg} />
                <button className="slds-button slds-button_neutral slds-m-left_x-small" onClick={() => setPurgeModalOpen(true)}>
                  Delete Logs
                </button>
              </Fragment>
            }
          >
            <Fragment>
              <SalesforceLogin
                className="slds-m-right_x-small"
                serverUrl={serverUrl}
                org={selectedOrg}
                skipFrontDoorAuth={skipFrontDoorAuth}
                returnUrl="/lightning/setup/ApexDebugLogs/home"
                omitIcon
                title="View debug logs in Salesforce"
              >
                View debug logs in Salesforce
              </SalesforceLogin>
              <Grid align="spread" verticalAlign="center">
                <div>
                  <Checkbox
                    id={`limit-logs-to-current-user`}
                    label="Show logs from all users"
                    checked={showLogsFromAllUsers}
                    disabled={loadingLog}
                    onChange={setShowLogsFromAllUsers}
                  />
                </div>
                <Grid>
                  {lastChecked && (
                    <>
                      <Tooltip content={isPaused ? 'Resume checking for logs' : 'Pause checking for new logs'}>
                        <button
                          className="slds-button slds-button_icon slds-button_icon-container slds-m-around_xxx-small"
                          onClick={() => togglePause()}
                        >
                          <Icon type="utility" icon={isPaused ? 'play' : 'pause'} className="slds-button__icon" omitContainer />
                        </button>
                      </Tooltip>
                      <p title={pollTitle} className="slds-text-color_weak slds-truncate">
                        <button
                          className="slds-button slds-button_icon slds-button_icon-container slds-m-around_xxx-small"
                          onClick={() => fetchLogs()}
                        >
                          <Icon
                            type="utility"
                            icon="refresh"
                            className={classNames('slds-button__icon', { spin: loading })}
                            omitContainer
                          />
                        </button>
                        Last Checked {formatDate(lastChecked, 'h:mm:ss')}
                      </p>
                    </>
                  )}
                </Grid>
              </Grid>
              <DebugLogViewerTable logs={logsWithViewedFlag} onRowSelection={handleActiveLogChange} />
            </Fragment>
          </Card>
        </div>
        <div className="slds-p-horizontal_x-small slds-is-relative">
          <Card
            className="h-100"
            icon={{ type: 'standard', icon: 'outcome' }}
            title={<div>Log Results</div>}
            actions={
              <Fragment>
                <button
                  className="slds-button"
                  title="Download Log"
                  onClick={() => downloadActiveLog()}
                  disabled={!activeLog || loadingLog}
                >
                  <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Download
                </button>
                <CopyToClipboard type="button" content={activeLog} disabled={!activeLog || loadingLog} />
              </Fragment>
            }
          >
            <div className="slds-p-top_xx-small">
              {loadingLog && <Spinner />}
              <DebugLogViewerFilter
                textFilter={textFilter}
                userDebug={userDebug}
                hasResults={!!activeLog}
                onTextChange={setTextFilter}
                onDebugChange={setUserDebug}
              />
              <Editor
                height="80vh"
                theme="vs-dark"
                defaultLanguage="apex-log"
                options={{
                  readOnly: true,
                  contextmenu: false,
                }}
                value={visibleResults}
                onMount={handleLogEditorMount}
              />
            </div>
          </Card>
        </div>
      </Split>
    </AutoFullHeightContainer>
  );
};

export default DebugLogViewer;
