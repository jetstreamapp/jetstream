import { css } from '@emotion/react';
import { Checkbox, Icon } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import type { TestClassListItem } from '../apex-test-runner-types';

export type ClassSelection = Set<string> | 'ALL' | undefined;

export interface TestClassSelectionRowProps {
  item: TestClassListItem;
  selection: ClassSelection;
  expanded: boolean;
  onToggleExpand: (classId: string) => void;
  onToggleClass: (classId: string) => void;
  onToggleMethod: (classId: string, method: string) => void;
}

export const TestClassSelectionRow: FunctionComponent<TestClassSelectionRowProps> = ({
  item,
  selection,
  expanded,
  onToggleExpand,
  onToggleClass,
  onToggleMethod,
}) => {
  const isChecked = selection === 'ALL' || (selection instanceof Set && selection.size === item.methods.length && item.methods.length > 0);
  const isIndeterminate = selection instanceof Set && selection.size > 0 && selection.size < item.methods.length;
  const canExpand = item.methods.length > 0;

  return (
    <li className="slds-item">
      <div
        css={css`
          display: flex;
          align-items: center;
        `}
      >
        <button
          className="slds-button slds-button_icon slds-button_icon-x-small slds-m-right_xx-small"
          title={expanded ? 'Collapse methods' : 'Expand methods'}
          disabled={!canExpand}
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
              />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

export default TestClassSelectionRow;
