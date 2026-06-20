import { css } from '@emotion/react';
import classNames from 'classnames';
import { ReactNode } from 'react';
import Icon from '../../../widgets/Icon';

/** Rem of indentation applied per tree depth level. */
const INDENT_PER_LEVEL_REM = 1.25;

export interface TreeExpanderProps {
  /** Row depth from `DataTableCellProps.depth` (0 = root). Drives indentation. */
  depth: number;
  /** From `DataTableCellProps.canExpand` — whether to render a chevron toggle vs. a spacer. */
  canExpand: boolean;
  /** From `DataTableCellProps.isExpanded`. */
  isExpanded: boolean;
  /** From `DataTableCellProps.toggleExpanded`. */
  onToggle: () => void;
  /** The cell content rendered to the right of the (indented) expander. */
  children: ReactNode;
}

/**
 * Standard expand/collapse affordance for a `getSubRows` tree column. Renders depth-based indentation
 * plus either a chevron toggle (expandable rows) or an aligned spacer (leaf rows), so every tree table
 * in the app shares one look instead of hand-rolling indentation/chevrons per feature.
 *
 * Compose it inside a column's `renderCell`, forwarding the tree sugar from `DataTableCellProps`:
 *
 *   renderCell: ({ value, depth, canExpand, isExpanded, toggleExpanded }) => (
 *     <TreeExpander depth={depth} canExpand={canExpand} isExpanded={isExpanded} onToggle={toggleExpanded}>
 *       {value}
 *     </TreeExpander>
 *   )
 */
export function TreeExpander({ depth, canExpand, isExpanded, onToggle, children }: TreeExpanderProps) {
  return (
    <div
      className="jgrid-tree-expander slds-grid slds-grid_vertical-align-center"
      css={css`
        margin-inline-start: ${depth * INDENT_PER_LEVEL_REM}rem;
      `}
    >
      {canExpand ? (
        <button
          type="button"
          className="jgrid-tree-toggle slds-button slds-button_icon slds-button_icon-container"
          // The grid owns roving tabindex/keyboard nav; keep the toggle out of the tab order like the
          // built-in group-row toggle and select-checkbox.
          tabIndex={-1}
          aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
          onClick={(event) => {
            // Don't let the click bubble into cell selection/edit handlers.
            event.stopPropagation();
            onToggle();
          }}
        >
          <Icon
            type="utility"
            icon={isExpanded ? 'chevrondown' : 'chevronright'}
            className="slds-button__icon slds-icon_x-small"
            omitContainer
          />
        </button>
      ) : (
        <span className={classNames('jgrid-tree-toggle-spacer')} aria-hidden="true" />
      )}
      <div className="jgrid-tree-expander-content slds-truncate">{children}</div>
    </div>
  );
}
