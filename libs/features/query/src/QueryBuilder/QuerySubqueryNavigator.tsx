import { css } from '@emotion/react';
import { getSubqueryPathDepth, pluralizeFromNumber } from '@jetstream/shared/utils';
import { Badge, Grid, Icon, Popover, PopoverRef } from '@jetstream/ui';
import { Fragment, FunctionComponent, useMemo, useRef } from 'react';
import { flattenSelectedSubqueryTree, SelectedSubqueryNode } from '../utils/subquery-navigation-utils';

export interface QuerySubqueryNavigatorProps {
  rootSObjectName: string;
  selectedSubqueryTree: SelectedSubqueryNode[];
  /** Relationship path being viewed, so the list can point out where the user currently is */
  currentRelationshipPath: string;
  /** Relationship path to jump to, empty for the root object */
  onNavigate: (relationshipPath: string) => void;
}

/**
 * Every related object in the query, since only one level of the subquery tree is listed at a time and nested
 * subqueries are otherwise invisible from anywhere but the level they live on.
 *
 * A jump list rather than a collapsible tree - every row is a destination, so there is nothing to collapse.
 * Nesting is shown by indenting each row to its depth. Only rendered when the query has at least one related object.
 */
export const QuerySubqueryNavigator: FunctionComponent<QuerySubqueryNavigatorProps> = ({
  rootSObjectName,
  selectedSubqueryTree,
  currentRelationshipPath,
  onNavigate,
}) => {
  const popoverRef = useRef<PopoverRef>(null);

  // The root object leads the list so that navigating back out of every subquery is reachable from here too
  const rows = useMemo(
    () => [
      { relationshipPath: '', label: rootSObjectName, childSObject: '', fieldCount: 0, depth: 0 },
      ...flattenSelectedSubqueryTree(selectedSubqueryTree).map(({ relationshipPath, relationshipName, childSObject, fieldCount }) => ({
        relationshipPath,
        label: relationshipName,
        childSObject,
        fieldCount,
        depth: getSubqueryPathDepth(relationshipPath),
      })),
    ],
    [rootSObjectName, selectedSubqueryTree],
  );
  const subqueryCount = rows.length - 1;

  function handleNavigate(relationshipPath: string) {
    onNavigate(relationshipPath);
    popoverRef.current?.close();
  }

  return (
    <Popover
      ref={popoverRef}
      testId="subquery-navigator-popover"
      size="medium"
      placement="bottom-end"
      tooltipProps={{ content: 'View and jump to any related object in the query', openDelay: 500 }}
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small">Related objects in the query</h2>
        </header>
      }
      content={
        <Fragment>
          <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_x-small">Select a related object to jump to it.</p>
          <ul
            css={css`
              max-height: 20rem;
              overflow: auto;
            `}
          >
            {rows.map(({ relationshipPath, label, childSObject, fieldCount, depth }) => (
              <li key={relationshipPath || 'subquery-root'}>
                <button
                  className="slds-button slds-button_reset slds-p-vertical_xx-small"
                  type="button"
                  onClick={() => handleNavigate(relationshipPath)}
                  css={css`
                    width: 100%;
                    text-align: left;
                    padding-left: ${depth * 1.25}rem;
                    &:hover {
                      background-color: var(--slds-g-color-surface-2, #f3f2f2);
                    }
                  `}
                >
                  <Grid verticalAlign="center" className="slds-has-flexi-truncate">
                    <span className="slds-truncate" title={childSObject ? `${label} (${childSObject})` : label}>
                      {label}
                    </span>
                    {fieldCount > 0 && (
                      <Badge className="slds-m-left_x-small" title={`${fieldCount} ${pluralizeFromNumber('field', fieldCount)} selected`}>
                        {fieldCount}
                      </Badge>
                    )}
                    {relationshipPath.toLowerCase() === currentRelationshipPath.toLowerCase() && (
                      <span className="slds-m-left_x-small slds-text-body_small slds-text-color_weak">viewing</span>
                    )}
                  </Grid>
                </button>
              </li>
            ))}
          </ul>
        </Fragment>
      }
      buttonProps={{ className: 'slds-button', 'data-testid': 'subquery-navigator-button' }}
    >
      <Icon type="utility" icon="hierarchy" className="slds-button__icon slds-button__icon_left" omitContainer />
      Selected ({subqueryCount})
    </Popover>
  );
};

export default QuerySubqueryNavigator;
