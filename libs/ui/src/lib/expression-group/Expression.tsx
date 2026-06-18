import { useDragOperation, useDroppable } from '@dnd-kit/react';
import { AndOr } from '@jetstream/types';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import Icon from '../widgets/Icon';
import { DraggableRow, ROW_DROP_PRIORITY_ROOT, RowDropTarget } from './expression-types';
import ExpressionActionDropDown from './ExpressionActionDropDown';

export interface ExpressionProps {
  value: AndOr;
  title?: string;
  actionHelpText?: string;
  actionLabel: string;
  ancillaryOptions?: React.ReactNode;
  onActionChange: (value: AndOr) => void;
  onAddCondition: () => void;
  onAddGroup: () => void;
  children?: React.ReactNode;
}

export const Expression: FunctionComponent<ExpressionProps> = ({
  value,
  title,
  actionLabel,
  actionHelpText,
  ancillaryOptions,
  children,
  onActionChange,
  onAddCondition,
  onAddGroup,
}) => {
  const { ref: dropRef, isDropTarget } = useDroppable({
    id: 'expression-root',
    accept: 'row',
    collisionPriority: ROW_DROP_PRIORITY_ROOT,
    data: { type: 'root' } satisfies RowDropTarget,
  });
  const { source } = useDragOperation();
  // Only highlight when dragging a row that currently lives in a group (it can move out to the root level).
  const sourceRow = source?.data as DraggableRow | undefined;
  const isValidDropTarget = isDropTarget && !!sourceRow?.groupKey;

  return (
    <div className="slds-expression">
      {title && <h2 className="slds-expression__title">{title}</h2>}
      <div
        className={classNames({
          'drop-zone-border': isValidDropTarget,
        })}
        ref={dropRef}
      >
        <ExpressionActionDropDown
          label={actionLabel}
          helpText={actionHelpText}
          value={value || 'AND'}
          ancillaryOptions={ancillaryOptions}
          onChange={onActionChange}
        />
        <ul>{children}</ul>
      </div>
      <div className="slds-expression__buttons">
        <button className="slds-button slds-button_neutral" onClick={() => onAddCondition()}>
          <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
          Add Condition
        </button>
        <button className="slds-button slds-button_neutral" onClick={() => onAddGroup()}>
          <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
          Add Group
        </button>
      </div>
    </div>
  );
};

export default Expression;
