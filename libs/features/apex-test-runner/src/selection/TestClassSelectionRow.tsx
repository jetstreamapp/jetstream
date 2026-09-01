import { css } from '@emotion/react';
import { Checkbox, Icon } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import type { TestClassListItem } from '../apex-test-runner-types';
import type { RovingCheckboxItemProps } from './useRovingCheckboxList';

export type ClassSelection = Set<string> | 'ALL' | undefined;

/** Composite-widget id for a method checkbox — class ids are Salesforce ids so ':' cannot collide */
export function methodRovingId(classId: string, method: string) {
  return `${classId}:${method}`;
}

export interface TestClassSelectionRowProps {
  item: TestClassListItem;
  selection: ClassSelection;
  expanded: boolean;
  /** Roving-tabindex props for this row's checkboxes — the list is one tab stop, arrows move within it */
  getItemProps: (rovingId: string) => RovingCheckboxItemProps;
  onToggleExpand: (classId: string) => void;
  onToggleClass: (classId: string) => void;
  onToggleMethod: (classId: string, method: string) => void;
}

export const TestClassSelectionRow: FunctionComponent<TestClassSelectionRowProps> = ({
  item,
  selection,
  expanded,
  getItemProps,
  onToggleExpand,
  onToggleClass,
  onToggleMethod,
}) => {
  const isChecked = selection === 'ALL' || (selection instanceof Set && selection.size === item.methods.length && item.methods.length > 0);
  const isIndeterminate = selection instanceof Set && selection.size > 0 && selection.size < item.methods.length;
  const canExpand = item.methods.length > 0;
  // The class checkbox is the focused element that ArrowRight/ArrowLeft expand and collapse from, so
  // it (not only the mouse-only chevron) carries the expanded state
  const { inputProps: rovingInputProps, ...rovingProps } = getItemProps(item.classId);

  return (
    <li className="slds-item">
      <div
        css={css`
          display: flex;
          align-items: center;
        `}
      >
        {/* Mouse affordance only (tabIndex -1) — keyboard users expand/collapse with ArrowRight/ArrowLeft
            from the class checkbox, keeping the list a single tab stop */}
        <button
          className="slds-button slds-button_icon slds-button_icon-x-small slds-m-right_xx-small"
          title={expanded ? 'Collapse methods' : 'Expand methods'}
          disabled={!canExpand}
          tabIndex={-1}
          aria-expanded={canExpand ? expanded : undefined}
          css={
            !canExpand
              ? css`
                  visibility: hidden;
                `
              : undefined
          }
          onClick={() => onToggleExpand(item.classId)}
        >
          <Icon
            type="utility"
            icon={expanded ? 'chevrondown' : 'chevronright'}
            className="slds-button__icon"
            omitContainer
            description={expanded ? 'Collapse' : 'Expand'}
          />
        </button>
        <Checkbox
          id={`test-class-${item.classId}`}
          checked={isChecked}
          indeterminate={isIndeterminate}
          label={item.name}
          onChange={() => onToggleClass(item.classId)}
          {...rovingProps}
          inputProps={{ ...rovingInputProps, 'aria-expanded': canExpand ? expanded : undefined }}
        />
        {item.symbolTableUnavailable && (
          <span
            className="slds-m-left_x-small slds-text-body_small slds-text-color_weak"
            title="This class could not be analyzed (it may need to be recompiled) — the entire class will run"
          >
            methods unavailable
          </span>
        )}
        {!item.symbolTableUnavailable && (
          <span className="slds-m-left_x-small slds-text-body_small slds-text-color_weak">
            {item.methods.length} {item.methods.length === 1 ? 'method' : 'methods'}
          </span>
        )}
      </div>
      {expanded && canExpand && (
        <ul
          css={css`
            margin-left: 2.5rem;
          `}
        >
          {item.methods.map((method) => (
            <li key={method}>
              <Checkbox
                id={`test-method-${item.classId}-${method}`}
                checked={selection === 'ALL' || (selection instanceof Set && selection.has(method))}
                label={method}
                onChange={() => onToggleMethod(item.classId, method)}
                {...getItemProps(methodRovingId(item.classId, method))}
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

export default TestClassSelectionRow;
