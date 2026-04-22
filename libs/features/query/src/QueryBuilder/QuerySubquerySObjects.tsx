import { css } from '@emotion/react';
import { formatNumber, queryFilterHasValue, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter, pluralizeFromNumber } from '@jetstream/shared/utils';
import {
  ChildRelationship,
  ExpressionConditionType,
  ExpressionType,
  QueryFieldWithPolymorphic,
  QueryOrderByClause,
  SalesforceOrgUi,
} from '@jetstream/types';
import {
  Accordion,
  Badge,
  DesertIllustration,
  EmptyState,
  Grid,
  GridCol,
  Icon,
  isExpressionConditionType,
  SearchInput,
  Tooltip,
} from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { Fragment, FunctionComponent, ReactNode, useEffect, useRef, useState } from 'react';
import QueryChildFields from './QueryChildFields';

const FILTER_OPERATOR_LABELS: Record<string, string> = {
  eq: '=',
  ne: '!=',
  lt: '<',
  lte: '<=',
  gt: '>',
  gte: '>=',
  contains: 'contains',
  doesNotContain: 'does not contain',
  startsWith: 'starts with',
  doesNotStartWith: 'does not start with',
  endsWith: 'ends with',
  doesNotEndWith: 'does not end with',
  isNull: 'is null',
  isNotNull: 'is not null',
  in: 'in',
  notIn: 'not in',
  includes: 'includes',
  excludes: 'excludes',
};

function getFilterRowText(row: ExpressionConditionType): string {
  const { resource, operator, value } = row.selected;
  const operatorLabel = (operator && FILTER_OPERATOR_LABELS[operator]) || operator || '';
  if (operator === 'isNull' || operator === 'isNotNull') {
    return `${resource} ${operatorLabel}`.trim();
  }
  const displayValue = Array.isArray(value) ? value.join(', ') : value;
  return `${resource} ${operatorLabel} ${displayValue}`.trim();
}

function getOrderByText(orderBy: QueryOrderByClause): string {
  let output = `${orderBy.fieldLabel || orderBy.field} ${orderBy.order === 'ASC' ? 'ASC (A to Z)' : 'DESC (Z to A)'}`;
  if (orderBy.nulls) {
    output += ` Nulls ${orderBy.nulls === 'FIRST' ? 'First' : 'Last'}`;
  }
  return output;
}

function buildSummaryTooltip(lines: { key: string | number; text: string }[]): ReactNode {
  if (!lines.length) {
    return null;
  }
  return (
    <ul
      css={css`
        max-width: 22rem;
      `}
    >
      {lines.map(({ key, text }) => (
        <li key={key} className="slds-truncate" title={text}>
          {text}
        </li>
      ))}
    </ul>
  );
}

function buildFilterTooltip(filter: ExpressionType | undefined): ReactNode {
  const lines = (filter?.rows ?? [])
    .flatMap((row) => (isExpressionConditionType(row) ? row : row.rows))
    .filter((row) => queryFilterHasValue(row))
    .map((row) => ({ key: row.key, text: getFilterRowText(row) }));
  return buildSummaryTooltip(lines);
}

function buildOrderByTooltip(orderByClauses: QueryOrderByClause[] | undefined): ReactNode {
  const lines = (orderByClauses ?? [])
    .filter((orderBy) => !!orderBy.field)
    .map((orderBy) => ({ key: orderBy.key, text: getOrderByText(orderBy) }));
  return buildSummaryTooltip(lines);
}

export interface QuerySubquerySObjectsProps {
  org: SalesforceOrgUi;
  serverUrl: string;
  isTooling: boolean;
  childRelationships: ChildRelationship[];
  onSelectionChanged: (relationshipName: string, fields: QueryFieldWithPolymorphic[]) => void;
}

export const QuerySubquerySObjects: FunctionComponent<QuerySubquerySObjectsProps> = ({
  org,
  serverUrl,
  isTooling,
  childRelationships,
  onSelectionChanged,
}) => {
  const [visibleChildRelationships, setVisibleChildRelationships] = useState<ChildRelationship[]>(childRelationships);
  const childRelationshipContentRef = useRef<Record<string, ReactNode>>({});
  // Field pickers are memoized in childRelationshipContentRef, so the picker created on first
  // expand permanently captures whatever onSelectionChanged was passed then. The parent recreates
  // that callback each render (it closes over the latest selected-fields state), so the cached
  // picker must call the latest handler via a ref to avoid overwriting newer subquery selections.
  const onSelectionChangedRef = useRef(onSelectionChanged);
  useEffect(() => {
    onSelectionChangedRef.current = onSelectionChanged;
  }, [onSelectionChanged]);
  const [textFilter, setTextFilter] = useState<string>('');
  const selectedFieldState = useAtomValue(fromQueryState.selectedSubqueryFieldsState);
  const subquerySummary = useAtomValue(fromQueryState.subqueryOptionsSummaryState);
  const [subqueryFilters, setSubqueryFilters] = useAtom(fromQueryState.querySubqueryFiltersState);
  const [subqueryOrderBys, setSubqueryOrderBys] = useAtom(fromQueryState.querySubqueryOrderByState);
  const setSubqueryLimit = useSetAtom(fromQueryState.querySubqueryLimitState);
  const setConfigPanel = useSetAtom(fromQueryState.subqueryConfigPanelState);

  function clearSubqueryOptions(relationshipName: string) {
    const omitRelationship = <T,>(prev: Record<string, T>): Record<string, T> => {
      if (!(relationshipName in prev)) {
        return prev;
      }
      const next = { ...prev };
      delete next[relationshipName];
      return next;
    };
    setSubqueryFilters(omitRelationship);
    setSubqueryOrderBys(omitRelationship);
    setSubqueryLimit(omitRelationship);
  }

  useNonInitialEffect(() => {
    setVisibleChildRelationships(childRelationships);
    setTextFilter('');
    childRelationshipContentRef.current = {};
  }, [childRelationships]);

  useNonInitialEffect(() => {
    if (textFilter) {
      setVisibleChildRelationships(
        childRelationships.filter(multiWordObjectFilter(['relationshipName', 'childSObject', 'field'], textFilter)),
      );
    } else {
      setVisibleChildRelationships(childRelationships);
    }
  }, [textFilter]);

  function buildSummaryParts(summary: { filterCount: number; hasOrderBy: boolean; limit: string | null } | undefined) {
    const parts: string[] = [];
    if (summary?.filterCount) {
      parts.push(`${summary.filterCount} ${pluralizeFromNumber('filter', summary.filterCount)}`);
    }
    if (summary?.hasOrderBy) {
      parts.push('sorted');
    }
    if (summary?.limit) {
      parts.push(`limit ${summary.limit}`);
    }
    return parts;
  }

  function getContent(childRelationship: ChildRelationship) {
    return () => {
      if (!childRelationship.relationshipName) {
        return;
      }
      // The "Configure" header is re-rendered each time because it depends on the latest
      // summary atom; the (heavier) field picker below is memoized in childRelationshipContentRef.
      const relationshipName = childRelationship.relationshipName;
      const summary = subquerySummary[relationshipName];
      let fieldPicker = childRelationshipContentRef.current[relationshipName];
      if (!fieldPicker) {
        fieldPicker = (
          <QueryChildFields
            org={org}
            serverUrl={serverUrl}
            isTooling={isTooling}
            selectedSObject={childRelationship.childSObject}
            parentRelationshipName={relationshipName}
            onSelectionChanged={(fields: QueryFieldWithPolymorphic[]) => onSelectionChangedRef.current(relationshipName, fields)}
          />
        );
        childRelationshipContentRef.current[relationshipName] = fieldPicker;
      }
      const hasSummary = !!summary && (!!summary.filterCount || summary.hasOrderBy || !!summary.limit);
      const hasSelectedFields = (selectedFieldState[relationshipName]?.length ?? 0) > 0;
      return (
        <Fragment>
          <div className="slds-p-around_x-small slds-border_bottom">
            <Grid verticalAlign="center" gutters guttersSize="x-small">
              <GridCol>
                {/* Wrapper span carries the title so a disabled button (which does not fire mouse events) still surfaces the hint on hover */}
                <span
                  css={css`
                    display: block;
                  `}
                  title={hasSelectedFields ? undefined : 'Select at least one field before configuring filter, order by, and limit'}
                >
                  <button
                    className="slds-button slds-button_neutral slds-button_stretch"
                    type="button"
                    disabled={!hasSelectedFields}
                    title={hasSelectedFields ? `Configure filter, order by, and limit for ${relationshipName}` : undefined}
                    onClick={() => setConfigPanel({ relationshipName, childSObject: childRelationship.childSObject })}
                    css={
                      hasSelectedFields
                        ? undefined
                        : css`
                            pointer-events: none;
                          `
                    }
                  >
                    <Icon type="utility" icon="settings" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Filter / Order By / Limit
                  </button>
                </span>
              </GridCol>
              {hasSummary && (
                <GridCol growNone>
                  <button
                    className="slds-button slds-button_icon slds-button_icon-border-filled"
                    type="button"
                    title={`Clear filter, order by, and limit for ${relationshipName}`}
                    onClick={() => clearSubqueryOptions(relationshipName)}
                  >
                    <Icon type="utility" icon="close" className="slds-button__icon" omitContainer />
                    <span className="slds-assistive-text">Clear subquery options for {relationshipName}</span>
                  </button>
                </GridCol>
              )}
            </Grid>
            {hasSummary && (
              <Grid align="spread" verticalAlign="center" wrap className="slds-m-top_x-small">
                <GridCol growNone>
                  <Grid verticalAlign="center" gutters guttersSize="small" wrap>
                    {summary?.filterCount ? (
                      <GridCol growNone>
                        <Tooltip content={buildFilterTooltip(subqueryFilters[relationshipName])}>
                          <span
                            className="slds-text-body_small slds-text-color_weak"
                            css={css`
                              cursor: help;
                            `}
                          >
                            <Icon
                              type="utility"
                              icon="filterList"
                              className="slds-icon slds-icon_xx-small slds-icon-text-default slds-m-right_xx-small"
                              omitContainer
                            />
                            {summary.filterCount} {pluralizeFromNumber('filter', summary.filterCount)}
                          </span>
                        </Tooltip>
                      </GridCol>
                    ) : null}
                    {summary?.hasOrderBy ? (
                      <GridCol growNone>
                        <Tooltip content={buildOrderByTooltip(subqueryOrderBys[relationshipName])}>
                          <span
                            className="slds-text-body_small slds-text-color_weak"
                            css={css`
                              cursor: help;
                            `}
                          >
                            <Icon
                              type="utility"
                              icon="arrowdown"
                              className="slds-icon slds-icon_xx-small slds-icon-text-default slds-m-right_xx-small"
                              omitContainer
                            />
                            sorted
                          </span>
                        </Tooltip>
                      </GridCol>
                    ) : null}
                  </Grid>
                </GridCol>
                {summary?.limit ? (
                  <GridCol growNone className="slds-text-body_small slds-text-color_weak">
                    limit {formatNumber(Number(summary.limit))}
                  </GridCol>
                ) : null}
              </Grid>
            )}
          </div>
          {fieldPicker}
        </Fragment>
      );
    };
  }

  function getCollapsedSummary(childRelationship: ChildRelationship) {
    if (!childRelationship.relationshipName) {
      return;
    }
    const queryFields = selectedFieldState[childRelationship.relationshipName];
    const summary = subquerySummary[childRelationship.relationshipName];

    if (!Array.isArray(queryFields) && !summary) {
      return;
    }

    const summaryText = buildSummaryParts(summary).join(' · ');

    return (
      <span
        css={css`
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        `}
      >
        {Array.isArray(queryFields) && (
          <Badge className="slds-truncate text-uppercase">
            {queryFields.length} {pluralizeFromNumber('field', queryFields.length)} selected
          </Badge>
        )}
        {summaryText && (
          <span
            className="slds-icon_container"
            css={css`
              display: inline-flex;
              align-items: center;
            `}
            title={`Configured: ${summaryText}`}
            aria-label={`Configured: ${summaryText}`}
          >
            <Icon type="utility" icon="filterList" className="slds-icon slds-icon_xx-small slds-icon-text-default" omitContainer />
          </span>
        )}
      </span>
    );
  }

  return (
    <Fragment>
      {childRelationships.length === 0 && (
        <EmptyState headline="There are no related objects" illustration={<DesertIllustration />}></EmptyState>
      )}
      {childRelationships.length > 0 && (
        <Fragment>
          <SearchInput
            id="subquery-filter"
            className="slds-p-around_xx-small"
            placeholder="Filter child objects"
            onChange={setTextFilter}
          />
          {visibleChildRelationships.length === 0 && (
            <EmptyState headline="There are no matching objects" subHeading="Adjust your selection."></EmptyState>
          )}
          <Accordion
            initOpenIds={[]}
            allowMultiple={false}
            sections={visibleChildRelationships.map((childRelationship) => ({
              id: `${childRelationship.relationshipName}-${childRelationship.childSObject}.${childRelationship.field}`,
              testId: childRelationship.relationshipName,
              titleText: `${childRelationship.relationshipName} (${childRelationship.childSObject}.${childRelationship.field})`,
              title: (
                <Grid align="spread" gutters>
                  <GridCol>
                    <Grid vertical gutters>
                      <GridCol>{childRelationship.relationshipName}</GridCol>
                      <GridCol className="slds-text-body_small slds-text-color_weak">
                        {childRelationship.childSObject}.{childRelationship.field}
                      </GridCol>
                    </Grid>
                  </GridCol>
                </Grid>
              ),
              titleSummaryIfCollapsed: getCollapsedSummary(childRelationship),
              content: getContent(childRelationship),
            }))}
          />
        </Fragment>
      )}
    </Fragment>
  );
};

export default QuerySubquerySObjects;
