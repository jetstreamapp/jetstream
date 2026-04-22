import { css } from '@emotion/react';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter, pluralizeFromNumber } from '@jetstream/shared/utils';
import { ChildRelationship, QueryFieldWithPolymorphic, SalesforceOrgUi } from '@jetstream/types';
import { Accordion, Badge, DesertIllustration, EmptyState, Grid, GridCol, Icon, SearchInput } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { useAtomValue, useSetAtom } from 'jotai';
import { Fragment, FunctionComponent, ReactNode, useRef, useState } from 'react';
import QueryChildFields from './QueryChildFields';

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
  const [textFilter, setTextFilter] = useState<string>('');
  const selectedFieldState = useAtomValue(fromQueryState.selectedSubqueryFieldsState);
  const subquerySummary = useAtomValue(fromQueryState.subqueryOptionsSummaryState);
  const setConfigPanel = useSetAtom(fromQueryState.subqueryConfigPanelState);

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
            onSelectionChanged={(fields: QueryFieldWithPolymorphic[]) => onSelectionChanged(relationshipName, fields)}
          />
        );
        childRelationshipContentRef.current[relationshipName] = fieldPicker;
      }
      return (
        <Fragment>
          <div className="slds-p-around_x-small slds-border_bottom">
            <Grid verticalAlign="center" gutters guttersSize="x-small" wrap>
              <GridCol growNone>
                <button
                  className="slds-button slds-button_neutral"
                  type="button"
                  title={`Configure filter, order by, and limit for ${relationshipName}`}
                  onClick={() => setConfigPanel({ relationshipName, childSObject: childRelationship.childSObject })}
                >
                  <Icon type="utility" icon="settings" className="slds-button__icon slds-button__icon_left" omitContainer />
                  Filter / Order By / Limit
                </button>
              </GridCol>
              {summary?.filterCount ? (
                <GridCol growNone className="slds-text-body_small slds-text-color_weak">
                  <Icon
                    type="utility"
                    icon="filterList"
                    className="slds-icon slds-icon_xx-small slds-icon-text-default slds-m-right_xx-small"
                    omitContainer
                  />
                  {summary.filterCount} {pluralizeFromNumber('filter', summary.filterCount)}
                </GridCol>
              ) : null}
              {summary?.hasOrderBy ? (
                <GridCol growNone className="slds-text-body_small slds-text-color_weak">
                  <Icon
                    type="utility"
                    icon="arrowdown"
                    className="slds-icon slds-icon_xx-small slds-icon-text-default slds-m-right_xx-small"
                    omitContainer
                  />
                  sorted
                </GridCol>
              ) : null}
              {summary?.limit ? (
                <GridCol growNone className="slds-text-body_small slds-text-color_weak">
                  limit {summary.limit}
                </GridCol>
              ) : null}
            </Grid>
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
