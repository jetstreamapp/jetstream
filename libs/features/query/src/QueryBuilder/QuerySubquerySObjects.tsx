import { MAX_SUBQUERY_DEPTH } from '@jetstream/shared/constants';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { isSubqueryPathBelow } from '@jetstream/shared/utils';
import { ChildRelationship, QueryFieldWithPolymorphic, SalesforceOrgUi } from '@jetstream/types';
import { Breadcrumbs, DesertIllustration, EmptyState, Grid, GridCol, Icon } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { getSubqueryFieldBaseKey } from '@jetstream/ui-core/shared';
import { useAtomValue, useSetAtom } from 'jotai';
import isNumber from 'lodash/isNumber';
import { Fragment, FunctionComponent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import QuerySubqueryLevel from './QuerySubqueryLevel';

/** One level of drill-in. An empty array means the base object's child relationships are being shown. */
interface SubqueryDrillLevel {
  relationshipPath: string;
  relationshipName: string;
  childSObject: string;
}

export interface QuerySubquerySObjectsProps {
  org: SalesforceOrgUi;
  serverUrl: string;
  isTooling: boolean;
  /** Child relationships of the root object */
  childRelationships: ChildRelationship[];
  rootSObjectName: string;
  onSelectionChanged: (relationshipPath: string, fields: QueryFieldWithPolymorphic[]) => void;
}

/**
 * Owns navigation through the subquery tree. Salesforce allows subqueries to be nested, so only one level is
 * shown at a time and the user drills in and out with the breadcrumb rather than the accordion nesting inside
 * itself. Everything scoped to a single level lives in QuerySubqueryLevel, which remounts as the level changes.
 */
export const QuerySubquerySObjects: FunctionComponent<QuerySubquerySObjectsProps> = ({
  org,
  serverUrl,
  isTooling,
  childRelationships,
  rootSObjectName,
  onSelectionChanged,
}) => {
  // Field pickers are cached across levels so navigating away and back does not rebuild them. A cached picker
  // permanently captures the callback it was created with, so selection changes are routed through a ref to
  // reach the latest handler, which closes over the latest selected-fields state.
  const fieldPickerCacheRef = useRef<Record<string, ReactNode>>({});
  const onSelectionChangedRef = useRef(onSelectionChanged);
  useEffect(() => {
    onSelectionChangedRef.current = onSelectionChanged;
  }, [onSelectionChanged]);
  const handleSelectionChanged = useCallback(
    (relationshipPath: string, fields: QueryFieldWithPolymorphic[]) => onSelectionChangedRef.current(relationshipPath, fields),
    [],
  );

  const [drillPath, setDrillPath] = useState<SubqueryDrillLevel[]>([]);
  const selectedFieldState = useAtomValue(fromQueryState.selectedSubqueryFieldsState);
  const queryFieldsMap = useAtomValue(fromQueryState.queryFieldsMapState);
  const clearSubqueries = useSetAtom(fromQueryState.clearSubqueriesBelow);

  const currentLevel = drillPath[drillPath.length - 1];
  const currentRelationshipPath = currentLevel?.relationshipPath || '';

  // Child relationships of the object being viewed. Below the root these come from the fields already
  // fetched for that subquery, which is guaranteed to have loaded because drilling in requires a field selection.
  const currentChildRelationships = useMemo(
    () =>
      currentLevel
        ? queryFieldsMap[getSubqueryFieldBaseKey(currentLevel.childSObject, currentLevel.relationshipPath)]?.childRelationships || []
        : childRelationships,
    [childRelationships, currentLevel, queryFieldsMap],
  );

  // Related objects that "Clear all" would remove: everything listed at this level plus anything nested beneath them
  const clearableSubqueryCount = useMemo(
    () =>
      Object.keys(selectedFieldState).filter(
        (path) => isSubqueryPathBelow(path, currentRelationshipPath) && selectedFieldState[path]?.length,
      ).length,
    [currentRelationshipPath, selectedFieldState],
  );

  useNonInitialEffect(() => {
    setDrillPath([]);
    fieldPickerCacheRef.current = {};
  }, [childRelationships]);

  /**
   * Nothing is left to configure at this level once it is cleared, so step back up to the level that
   * still has selections rather than leaving the user on an empty list.
   */
  function handleClearAll() {
    clearSubqueries(currentRelationshipPath);
    setDrillPath((prev) => prev.slice(0, -1));
  }

  /**
   * Link to remove every related object at the level being viewed and anything nested beneath it.
   * Rendered next to the breadcrumb when drilled in, and in the object list header at the root.
   */
  function renderClearAllButton() {
    if (!clearableSubqueryCount) {
      return null;
    }
    return (
      <GridCol growNone>
        <button
          className="slds-button"
          type="button"
          title={
            currentLevel
              ? `Remove all related objects nested under ${currentLevel.relationshipName}, including anything nested within them`
              : 'Remove all related objects from the query, including nested ones'
          }
          onClick={handleClearAll}
        >
          <Icon type="utility" icon="clear" className="slds-button__icon slds-button__icon_left" omitContainer />
          Clear all ({clearableSubqueryCount})
        </button>
      </GridCol>
    );
  }

  return (
    <Fragment>
      {drillPath.length > 0 && (
        <div className="slds-p-around_x-small slds-border_bottom">
          <Breadcrumbs
            items={[
              { id: 'subquery-root', label: rootSObjectName, metadata: -1 },
              ...drillPath.slice(0, -1).map((level, index) => ({
                id: level.relationshipPath,
                label: level.relationshipName,
                metadata: index,
              })),
            ]}
            currentItem={currentLevel?.relationshipName}
            onClick={(item) => isNumber(item.metadata) && setDrillPath((prev) => prev.slice(0, item.metadata + 1))}
          />
          <Grid align="spread" verticalAlign="center" wrap className="slds-m-top_xx-small">
            <GridCol className="slds-text-body_small slds-text-color_weak">
              Related objects of {currentLevel?.childSObject} · depth {drillPath.length + 1} of {MAX_SUBQUERY_DEPTH}
            </GridCol>
            {renderClearAllButton()}
          </Grid>
        </div>
      )}
      {currentChildRelationships.length === 0 && (
        <EmptyState
          headline={`There are no related objects${currentLevel ? ` for ${currentLevel.childSObject}` : ''}`}
          illustration={<DesertIllustration />}
        ></EmptyState>
      )}
      {currentChildRelationships.length > 0 && (
        // Remounting on level change resets the per-level filters and collapses the accordion
        <QuerySubqueryLevel
          key={`${rootSObjectName}:${currentRelationshipPath}`}
          org={org}
          serverUrl={serverUrl}
          isTooling={isTooling}
          relationshipPath={currentRelationshipPath}
          childRelationships={currentChildRelationships}
          fieldPickerCacheRef={fieldPickerCacheRef}
          // Once drilled in the clear action lives in the breadcrumb block instead, next to the level it applies to
          clearAllButton={drillPath.length === 0 ? renderClearAllButton() : undefined}
          onSelectionChanged={handleSelectionChanged}
          onDrillIn={(level) => setDrillPath((prev) => [...prev, level])}
        />
      )}
    </Fragment>
  );
};

export default QuerySubquerySObjects;
