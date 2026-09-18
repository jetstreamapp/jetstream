import { css } from '@emotion/react';
import { MAX_SUBQUERY_DEPTH } from '@jetstream/shared/constants';
import { formatNumber, queryFilterHasValue } from '@jetstream/shared/ui-utils';
import { getSubqueryPath, getSubqueryPathDepth, multiWordObjectFilter, pluralizeFromNumber } from '@jetstream/shared/utils';
import {
  ChildRelationship,
  ExpressionConditionType,
  ExpressionType,
  QueryFieldWithPolymorphic,
  QueryOrderByClause,
  SalesforceOrgUi,
} from '@jetstream/types';
import { Accordion, Badge, EmptyState, Grid, GridCol, Icon, isExpressionConditionType, SearchInput, Tooltip } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { useAtomValue, useSetAtom } from 'jotai';
import { Fragment, FunctionComponent, MutableRefObject, ReactNode, useMemo, useState } from 'react';
import { SelectedSubqueryNode, SubqueryDrillLevel } from '../utils/subquery-navigation-utils';
import QueryChildFields from './QueryChildFields';
import QuerySubqueryFilter, { DEFAULT_SUBQUERY_OBJECT_FILTER, SubqueryObjectFilter } from './QuerySubqueryFilter';

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

/**
 * A disabled button does not fire mouse events, so the hint explaining why it is disabled has to live on a
 * wrapper element and pointer events have to be suppressed on the button itself.
 */
function ButtonWithDisabledHint({
  disabled,
  hint,
  title,
  onClick,
  children,
}: {
  disabled: boolean;
  hint: string;
  title?: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <span
      css={css`
        display: block;
      `}
      title={disabled ? hint : undefined}
    >
      <button
        className="slds-button slds-button_neutral slds-button_stretch"
        type="button"
        disabled={disabled}
        title={disabled ? undefined : title}
        onClick={onClick}
        css={
          disabled
            ? css`
                pointer-events: none;
              `
            : undefined
        }
      >
        {children}
      </button>
    </span>
  );
}

function getSectionId(currentRelationshipPath: string, { relationshipName, childSObject, field }: ChildRelationship) {
  return `${getSubqueryPath(currentRelationshipPath, relationshipName || '')}-${childSObject}.${field}`;
}

export interface QuerySubqueryLevelProps {
  org: SalesforceOrgUi;
  serverUrl: string;
  isTooling: boolean;
  /** Relationship path of the subquery being viewed, empty at the root object */
  relationshipPath: string;
  /** Child relationships of the object being viewed */
  childRelationships: ChildRelationship[];
  /** Shared across levels so an expanded field picker survives navigating away and back */
  fieldPickerCacheRef: MutableRefObject<Record<string, ReactNode>>;
  /** Subquery to open and scroll to as this level is rendered, set when navigating from the navigator */
  focusedRelationshipPath: string | null;
  /**
   * Every related object the query contains, keyed by lower cased relationship path. The level reads which of
   * its relationships are in the query, and what is nested within each, from here rather than re-deriving it.
   */
  selectedSubqueryNodesByPath: Map<string, SelectedSubqueryNode>;
  onSelectionChanged: (relationshipPath: string, fields: QueryFieldWithPolymorphic[]) => void;
  onDrillIn: (level: SubqueryDrillLevel) => void;
}

/**
 * The list of related objects for a single level of the subquery tree.
 *
 * Everything scoped to a level lives here, so the parent remounts this component when the level changes
 * rather than resetting each piece of state by hand.
 */
export const QuerySubqueryLevel: FunctionComponent<QuerySubqueryLevelProps> = ({
  org,
  serverUrl,
  isTooling,
  relationshipPath: currentRelationshipPath,
  childRelationships,
  fieldPickerCacheRef,
  focusedRelationshipPath,
  selectedSubqueryNodesByPath,
  onSelectionChanged,
  onDrillIn,
}) => {
  const [textFilter, setTextFilter] = useState<string>('');
  const [objectFilter, setObjectFilter] = useState<SubqueryObjectFilter>(DEFAULT_SUBQUERY_OBJECT_FILTER);
  const selectedFieldState = useAtomValue(fromQueryState.selectedSubqueryFieldsState);
  const subquerySummary = useAtomValue(fromQueryState.subqueryOptionsSummaryState);
  const subqueryFilters = useAtomValue(fromQueryState.querySubqueryFiltersState);
  const subqueryOrderBys = useAtomValue(fromQueryState.querySubqueryOrderByState);
  const setConfigPanel = useSetAtom(fromQueryState.subqueryConfigPanelState);
  const clearSubqueryOptions = useSetAtom(fromQueryState.clearSubqueryOptionsForPath);

  /** The node for one of this level's relationships, which exists only when the query contains it */
  function getSelectedSubqueryNode(relationshipPath: string) {
    return selectedSubqueryNodesByPath.get(relationshipPath.toLowerCase());
  }

  /**
   * The accordion only honors initOpenIds as it mounts, and this component is remounted whenever navigation
   * changes, so opening and scrolling to a subquery picked from the navigator happens as part of that mount.
   */
  const focusedSectionId = useMemo(() => {
    const focusedChildRelationship =
      focusedRelationshipPath &&
      childRelationships.find(
        ({ relationshipName }) =>
          !!relationshipName &&
          getSubqueryPath(currentRelationshipPath, relationshipName).toLowerCase() === focusedRelationshipPath.toLowerCase(),
      );
    return focusedChildRelationship ? getSectionId(currentRelationshipPath, focusedChildRelationship) : null;
  }, [childRelationships, currentRelationshipPath, focusedRelationshipPath]);

  const visibleChildRelationships = useMemo(() => {
    let relationships = childRelationships;
    if (objectFilter === 'selected') {
      relationships = relationships.filter(({ relationshipName }) =>
        selectedSubqueryNodesByPath.has(getSubqueryPath(currentRelationshipPath, relationshipName || '').toLowerCase()),
      );
    }
    if (textFilter) {
      relationships = relationships.filter(multiWordObjectFilter(['relationshipName', 'childSObject', 'field'], textFilter));
    }
    return relationships;
  }, [childRelationships, currentRelationshipPath, objectFilter, selectedSubqueryNodesByPath, textFilter]);

  function getContent(childRelationship: ChildRelationship) {
    return () => {
      if (!childRelationship.relationshipName) {
        return;
      }
      // The "Configure" header is re-rendered each time because it depends on the latest
      // summary atom; the (heavier) field picker below is memoized in fieldPickerCacheRef.
      const relationshipName = childRelationship.relationshipName;
      const relationshipPath = getSubqueryPath(currentRelationshipPath, relationshipName);
      const summary = subquerySummary[relationshipPath];
      let fieldPicker = fieldPickerCacheRef.current[relationshipPath];
      if (!fieldPicker) {
        fieldPicker = (
          <QueryChildFields
            org={org}
            serverUrl={serverUrl}
            isTooling={isTooling}
            selectedSObject={childRelationship.childSObject}
            relationshipPath={relationshipPath}
            onSelectionChanged={(fields: QueryFieldWithPolymorphic[]) => onSelectionChanged(relationshipPath, fields)}
          />
        );
        fieldPickerCacheRef.current[relationshipPath] = fieldPicker;
      }
      const hasSummary = !!summary && (!!summary.filterCount || summary.hasOrderBy || !!summary.limit);
      const hasSelectedFields = (selectedFieldState[relationshipPath]?.length ?? 0) > 0;
      // A subquery stays in the query when only something nested within it has fields, so drilling in has to
      // stay available in that case - otherwise those nested objects become unreachable and unremovable.
      const hasNestedSelections = (getSelectedSubqueryNode(relationshipPath)?.children.length ?? 0) > 0;
      const canDrillIn = hasSelectedFields || hasNestedSelections;
      const canNestFurther = getSubqueryPathDepth(relationshipPath) < MAX_SUBQUERY_DEPTH;
      const childSObject = childRelationship.childSObject;
      return (
        <Fragment>
          {/* Kept above the field list so it stays reachable without scrolling past every field */}
          {canNestFurther && (
            <div className="slds-p-around_x-small slds-border_bottom">
              <ButtonWithDisabledHint
                disabled={!canDrillIn}
                hint={`Select at least one field on ${relationshipName} before adding a related object`}
                onClick={() => onDrillIn({ relationshipPath, relationshipName, childSObject })}
              >
                <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
                Add related object of {childSObject}
              </ButtonWithDisabledHint>
            </div>
          )}
          <div className="slds-p-around_x-small slds-border_bottom">
            <Grid verticalAlign="center" gutters guttersSize="x-small">
              <GridCol>
                <ButtonWithDisabledHint
                  disabled={!hasSelectedFields}
                  hint="Select at least one field before configuring filter, order by, and limit"
                  title={`Configure filter, order by, and limit for ${relationshipPath}`}
                  onClick={() => setConfigPanel({ relationshipPath, childSObject })}
                >
                  <Icon type="utility" icon="settings" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Filter / Order By / Limit
                </ButtonWithDisabledHint>
              </GridCol>
              {hasSummary && (
                <GridCol growNone>
                  <button
                    className="slds-button slds-button_icon slds-button_icon-border-filled"
                    type="button"
                    title={`Clear filter, order by, and limit for ${relationshipPath}`}
                    onClick={() => clearSubqueryOptions(relationshipPath)}
                  >
                    <Icon type="utility" icon="close" className="slds-button__icon" omitContainer />
                    <span className="slds-assistive-text">Clear subquery options for {relationshipPath}</span>
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
                        <Tooltip content={buildFilterTooltip(subqueryFilters[relationshipPath])}>
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
                        <Tooltip content={buildOrderByTooltip(subqueryOrderBys[relationshipPath])}>
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
    const relationshipPath = getSubqueryPath(currentRelationshipPath, childRelationship.relationshipName);
    const queryFields = selectedFieldState[relationshipPath];
    const summary = subquerySummary[relationshipPath];
    // Surfaces nested subqueries on the collapsed row, which is the only hint they exist without drilling in
    const nestedSubqueryCount = getSelectedSubqueryNode(relationshipPath)?.children.length ?? 0;

    if (!Array.isArray(queryFields) && !summary && !nestedSubqueryCount) {
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
        {nestedSubqueryCount > 0 && (
          <Badge className="slds-truncate text-uppercase">
            {nestedSubqueryCount} related {pluralizeFromNumber('object', nestedSubqueryCount)}
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
      <SearchInput id="subquery-filter" className="slds-p-around_xx-small" placeholder="Filter child objects" onChange={setTextFilter} />
      <div className="slds-p-horizontal_xx-small slds-p-bottom_xx-small">
        <Grid align="spread" verticalAlign="center">
          <GridCol className="slds-text-body_small slds-text-color_weak">
            Showing {formatNumber(visibleChildRelationships.length)} of {formatNumber(childRelationships.length)} objects
          </GridCol>
          <GridCol growNone>
            <QuerySubqueryFilter selectedFilter={objectFilter} onChange={setObjectFilter} />
          </GridCol>
        </Grid>
      </div>
      {visibleChildRelationships.length === 0 && (
        <EmptyState headline="There are no matching objects" subHeading="Adjust your selection."></EmptyState>
      )}
      <Accordion
        initOpenIds={focusedSectionId ? [focusedSectionId] : []}
        scrollInitOpenIdIntoView
        allowMultiple={false}
        // An object can have dozens of child relationships — one tab stop with ArrowUp/ArrowDown
        // between headers keeps the rest of the page reachable by keyboard
        singleTabStop
        sections={visibleChildRelationships.map((childRelationship) => ({
          id: getSectionId(currentRelationshipPath, childRelationship),
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
  );
};

export default QuerySubqueryLevel;
