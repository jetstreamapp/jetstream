import { css } from '@emotion/react';
import { DATE_FORMATS } from '@jetstream/shared/constants';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { UiTabSection } from '@jetstream/types';
import { Checkbox, Grid, Icon, Popover, Select, Tabs, TabsRef, Tooltip } from '@jetstream/ui';
import { useAtom, useAtomValue } from 'jotai';
import { FunctionComponent, useMemo, useRef } from 'react';
import { MAX_RECORDS_PER_GROUP } from '../load-records-multi-object-utils';
import {
  datasetsState,
  dateFormatState,
  graphErrorsState,
  groupsByRefIdState,
  insertNullsState,
  loadIsRunningState,
  parseErrorsState,
  parseWarningsState,
  requestsState,
} from '../load-records-multi-object.state';
import LoadRecordsMultiObjectErrorSummary from './LoadRecordsMultiObjectErrorSummary';
import LoadRecordsMultiObjectGroupsOverview from './LoadRecordsMultiObjectGroupsOverview';
import LoadRecordsMultiObjectSheetPreview from './LoadRecordsMultiObjectSheetPreview';
import { buildSheetPreviewData, getGroupNumbersByGraphId, getGroupSummary } from './review-utils';

const GROUPS_TAB_ID = '__groups__';

const GROUPS_TOOLTIP =
  'Records that reference each other (directly or through other records) form a group. Each group is sent to Salesforce as one ' +
  `all-or-nothing transaction: if any record in it fails, the whole group is rolled back. One group can contain up to ${MAX_RECORDS_PER_GROUP} records.`;

/** Step 1 (post-upload): summary, load options, error triage, and per-worksheet data preview */
export const LoadRecordsMultiObjectReview: FunctionComponent = () => {
  const datasets = useAtomValue(datasetsState);
  const parseErrors = useAtomValue(parseErrorsState);
  const parseWarnings = useAtomValue(parseWarningsState);
  const graphErrors = useAtomValue(graphErrorsState);
  const groupsByRefId = useAtomValue(groupsByRefIdState);
  const requests = useAtomValue(requestsState);
  const loadIsRunning = useAtomValue(loadIsRunningState);
  const [dateFormat, setDateFormat] = useAtom(dateFormatState);
  const [insertNulls, setInsertNulls] = useAtom(insertNullsState);

  const tabsRef = useRef<TabsRef>(null);

  const allErrors = useMemo(() => [...parseErrors, ...graphErrors], [parseErrors, graphErrors]);
  const groupNumbersByGraphId = useMemo(() => getGroupNumbersByGraphId(groupsByRefId), [groupsByRefId]);
  const { groupCount, largestGroupSize } = useMemo(() => getGroupSummary(groupsByRefId), [groupsByRefId]);

  const totalRecords = useMemo(() => (datasets || []).reduce((count, { data }) => count + data.length, 0), [datasets]);

  const sheetPreviews = useMemo(
    () =>
      (datasets || []).map((dataset) => ({
        dataset,
        previewData: buildSheetPreviewData({
          dataset,
          errors: [...dataset.errors, ...graphErrors.filter(({ worksheet }) => worksheet === dataset.worksheet)],
          groupsByRefId,
          groupNumbersByGraphId,
        }),
      })),
    [datasets, graphErrors, groupsByRefId, groupNumbersByGraphId],
  );

  const tabs = useMemo((): UiTabSection[] => {
    const sheetTabs = sheetPreviews.map(({ dataset, previewData }): UiTabSection => {
      const { errorCount } = previewData;
      return {
        id: dataset.worksheet,
        titleText: dataset.worksheet,
        title: (
          <span>
            {dataset.worksheet}
            {errorCount > 0 && (
              <span
                className="slds-badge slds-theme_error slds-m-left_x-small"
                title={`${formatNumber(errorCount)} ${pluralizeFromNumber('error', errorCount)} on this worksheet`}
              >
                {formatNumber(errorCount)}
              </span>
            )}
          </span>
        ),
        content: <LoadRecordsMultiObjectSheetPreview dataset={dataset} previewData={previewData} />,
      };
    });
    return [
      {
        id: GROUPS_TAB_ID,
        titleText: 'Groups',
        title: (
          <span>
            <Icon type="utility" icon="strategy" className="slds-icon slds-icon_xx-small slds-icon-text-default slds-m-right_xx-small" />
            Groups
          </span>
        ),
        content: (
          <LoadRecordsMultiObjectGroupsOverview
            datasets={datasets || []}
            groupsByRefId={groupsByRefId}
            groupNumbersByGraphId={groupNumbersByGraphId}
          />
        ),
      },
      ...sheetTabs,
    ];
  }, [sheetPreviews, datasets, groupsByRefId, groupNumbersByGraphId]);

  if (!datasets?.length) {
    return null;
  }

  return (
    <div>
      <Grid align="spread" verticalAlign="center" wrap className="slds-m-top_x-small">
        <div>
          <span className="slds-text-heading_small">
            {formatNumber(totalRecords)} {pluralizeFromNumber('record', totalRecords)} across {formatNumber(datasets.length)}{' '}
            {pluralizeFromNumber('worksheet', datasets.length)}
          </span>
          {allErrors.length > 0 ? (
            <span className="slds-badge slds-theme_error slds-m-left_small">
              {formatNumber(allErrors.length)} {pluralizeFromNumber('error', allErrors.length)} to resolve
            </span>
          ) : (
            <span className="slds-m-left_small slds-text-color_weak">
              <Tooltip content={GROUPS_TOOLTIP}>
                <span
                  css={css`
                    text-decoration: underline dotted;
                    cursor: help;
                  `}
                >
                  {formatNumber(groupCount)} {pluralizeFromNumber('group', groupCount)}
                </span>
              </Tooltip>
              {' · largest group '}
              {formatNumber(largestGroupSize)}/{formatNumber(MAX_RECORDS_PER_GROUP)}
              {requests?.length ? ` · ${formatNumber(requests.length)} API ${pluralizeFromNumber('request', requests.length)}` : ''}
            </span>
          )}
        </div>
        <Popover
          placement="bottom-end"
          header={
            <header className="slds-popover__header">
              <h2 className="slds-text-heading_small">Load Options</h2>
            </header>
          }
          content={
            <div>
              <Checkbox
                id="insert-null-values"
                checked={insertNulls}
                label="Clear Fields with Blank Values"
                labelHelp="Select this option to clear any mapped fields where the field is blank in your file. This only applies to record updates."
                disabled={loadIsRunning}
                onChange={setInsertNulls}
              />
              <Select
                id="date-format"
                label="Date Format"
                labelHelp="Specify the format of any date fields in your file. Jetstream just needs to know the order of the month and the day and will auto-detect the exact format."
              >
                <select
                  aria-describedby="date-format"
                  className="slds-select"
                  id="date-format-select"
                  required
                  value={dateFormat}
                  disabled={loadIsRunning}
                  onChange={(event) => setDateFormat(event.target.value)}
                >
                  <option value={DATE_FORMATS.MM_DD_YYYY}>{DATE_FORMATS.MM_DD_YYYY}</option>
                  <option value={DATE_FORMATS.DD_MM_YYYY}>{DATE_FORMATS.DD_MM_YYYY}</option>
                  <option value={DATE_FORMATS.YYYY_MM_DD}>{DATE_FORMATS.YYYY_MM_DD}</option>
                </select>
              </Select>
            </div>
          }
          buttonProps={{ className: 'slds-button slds-button_neutral' }}
        >
          <Icon type="utility" icon="settings" className="slds-button__icon slds-button__icon_left" />
          Load Options
        </Popover>
      </Grid>
      <LoadRecordsMultiObjectErrorSummary
        errors={allErrors}
        warnings={parseWarnings}
        onSelectWorksheet={(worksheet) => tabsRef.current?.changeTab(worksheet)}
      />
      <Tabs ref={tabsRef} tabs={tabs} renderAllContent initialActiveId={allErrors.length ? tabs[1]?.id : GROUPS_TAB_ID} />
    </div>
  );
};

export default LoadRecordsMultiObjectReview;
