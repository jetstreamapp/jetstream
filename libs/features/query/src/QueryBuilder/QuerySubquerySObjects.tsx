import { MAX_SUBQUERY_DEPTH } from '@jetstream/shared/constants';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { ChildRelationship, QueryFieldWithPolymorphic, SalesforceOrgUi } from '@jetstream/types';
import { Breadcrumbs, DesertIllustration, EmptyState, Grid, GridCol, Icon } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { getSubqueryFieldBaseKey } from '@jetstream/ui-core/shared';
import { useAtomValue, useSetAtom } from 'jotai';
import isNumber from 'lodash/isNumber';
import { FunctionComponent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildSelectedSubqueryTree,
  countSubqueriesBelow,
  getAncestorDrillLevels,
  getSelectedSubqueryNodesByPath,
  getSubquerySObjectByPath,
  SubqueryDrillLevel,
} from '../utils/subquery-navigation-utils';
import QuerySubqueryLevel from './QuerySubqueryLevel';
import QuerySubqueryNavigator from './QuerySubqueryNavigator';

interface SubqueryNavigationState {
  /** Levels drilled into. An empty array means the base object's child relationships are being shown. */
  levels: SubqueryDrillLevel[];
  /** Set when arriving from the navigator so the subquery that was picked is opened rather than just listed */
  focusedRelationshipPath: string | null;
  /** Bumped on each jump from the navigator so picking the same subquery again re-opens it */
  jumpCount: number;
}

const INITIAL_NAVIGATION: SubqueryNavigationState = { levels: [], focusedRelationshipPath: null, jumpCount: 0 };

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

  const [navigation, setNavigation] = useState<SubqueryNavigationState>(INITIAL_NAVIGATION);
  const selectedFieldState = useAtomValue(fromQueryState.selectedSubqueryFieldsState);
  const queryFieldsMap = useAtomValue(fromQueryState.queryFieldsMapState);
  const clearSubqueries = useSetAtom(fromQueryState.clearSubqueriesBelow);

  const { levels, focusedRelationshipPath, jumpCount } = navigation;
  const currentLevel = levels[levels.length - 1];
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

  /** Every related object the query contains, which the navigator, the clear action, and each level are scoped from */
  const selectedSubqueryTree = useMemo(
    () => buildSelectedSubqueryTree(selectedFieldState, getSubquerySObjectByPath(queryFieldsMap)),
    [queryFieldsMap, selectedFieldState],
  );
  const selectedSubqueryNodesByPath = useMemo(() => getSelectedSubqueryNodesByPath(selectedSubqueryTree), [selectedSubqueryTree]);

  // Related objects that "Clear all" would remove: everything listed at this level plus anything nested beneath them
  const clearableSubqueryCount = useMemo(
    () => countSubqueriesBelow(selectedSubqueryTree, currentRelationshipPath),
    [currentRelationshipPath, selectedSubqueryTree],
  );

  useNonInitialEffect(() => {
    setNavigation(INITIAL_NAVIGATION);
    fieldPickerCacheRef.current = {};
  }, [childRelationships]);

  /** Every move other than a navigator jump drops the focused subquery so that it is not re-opened on arrival */
  function goToLevels(getLevels: (currentLevels: SubqueryDrillLevel[]) => SubqueryDrillLevel[]) {
    setNavigation((prev) => ({ ...prev, levels: getLevels(prev.levels), focusedRelationshipPath: null }));
  }

  /**
   * Nothing is left to configure at this level once it is cleared, so step back up to the level that
   * still has selections rather than leaving the user on an empty list. The Clear all button unmounts
   * with that, so focus lands on the first control of the level that replaces it instead of <body>.
   */
  const containerRef = useRef<HTMLDivElement>(null);
  function handleClearAll() {
    clearSubqueries(currentRelationshipPath);
    goToLevels((currentLevels) => currentLevels.slice(0, -1));
    window.setTimeout(() => {
      containerRef.current?.querySelector<HTMLElement>('button, a[href], input, [tabindex="0"]')?.focus();
    });
  }

  /**
   * Jump straight to a related object picked from the navigator, which requires drilling into each of its
   * ancestors so the level that lists it is the one being viewed.
   */
  function handleNavigate(relationshipPath: string) {
    setNavigation((prev) => ({
      levels: getAncestorDrillLevels(selectedSubqueryTree, relationshipPath),
      focusedRelationshipPath: relationshipPath || null,
      jumpCount: prev.jumpCount + 1,
    }));
  }

  /** Breadcrumb items carry the index of the level they navigate back to, and -1 for the root object */
  function handleBreadcrumbClick(levelIndex: unknown) {
    if (!isNumber(levelIndex)) {
      return;
    }
    goToLevels((currentLevels) => currentLevels.slice(0, levelIndex + 1));
  }

  /** Only rendered when the level being viewed has something to clear */
  function renderClearAllButton() {
    if (clearableSubqueryCount === 0) {
      return null;
    }
    return (
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
    );
  }

  return (
    // display: contents keeps the wrapper out of the layout; it only scopes the focus fallback below
    <div ref={containerRef} style={{ display: 'contents' }}>
      {levels.length > 0 && (
        <div className="slds-p-around_x-small slds-border_bottom">
          <Breadcrumbs
            items={[
              { id: 'subquery-root', label: rootSObjectName, metadata: -1 },
              ...levels.slice(0, -1).map((level, index) => ({
                id: level.relationshipPath,
                label: level.relationshipName,
                metadata: index,
              })),
            ]}
            currentItem={currentLevel?.relationshipName}
            onClick={(item) => handleBreadcrumbClick(item.metadata)}
          />
          <div className="slds-text-body_small slds-text-color_weak slds-m-top_xx-small">
            Related objects of {currentLevel?.childSObject} · depth {levels.length + 1} of {MAX_SUBQUERY_DEPTH}
          </div>
        </div>
      )}
      {/* Kept outside the level so that the navigator stays reachable even on a level with nothing to list */}
      {selectedSubqueryTree.length > 0 && (
        <div className="slds-p-horizontal_xx-small slds-p-top_xx-small">
          <Grid align="spread" verticalAlign="center" wrap>
            <GridCol growNone>
              <QuerySubqueryNavigator
                rootSObjectName={rootSObjectName}
                selectedSubqueryTree={selectedSubqueryTree}
                currentRelationshipPath={currentRelationshipPath}
                onNavigate={handleNavigate}
              />
            </GridCol>
            <GridCol growNone>{renderClearAllButton()}</GridCol>
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
        // Remounting on navigation resets the per-level filters, collapses the accordion, and lets a subquery
        // picked from the navigator be opened as the accordion initializes
        <QuerySubqueryLevel
          key={`${rootSObjectName}:${currentRelationshipPath}:${focusedRelationshipPath || ''}:${jumpCount}`}
          org={org}
          serverUrl={serverUrl}
          isTooling={isTooling}
          relationshipPath={currentRelationshipPath}
          childRelationships={currentChildRelationships}
          fieldPickerCacheRef={fieldPickerCacheRef}
          focusedRelationshipPath={focusedRelationshipPath}
          selectedSubqueryNodesByPath={selectedSubqueryNodesByPath}
          onSelectionChanged={handleSelectionChanged}
          onDrillIn={(level) => goToLevels((currentLevels) => [...currentLevels, level])}
        />
      )}
    </div>
  );
};

export default QuerySubquerySObjects;
