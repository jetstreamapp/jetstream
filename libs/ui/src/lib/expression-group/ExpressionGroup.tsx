import { useDragOperation, useDroppable } from '@dnd-kit/react';
import { AndOr } from '@jetstream/types';
import classNames from 'classnames';
import React, { FunctionComponent } from 'react';
import Icon from '../widgets/Icon';
import { DraggableRow, ROW_DROP_PRIORITY_GROUP, RowDropTarget } from './expression-types';
import ExpressionActionDropDown from './ExpressionActionDropDown';

export interface ExpressionGroupProps {
  groupKey: number;
  group: number;
  parentAction: AndOr;
  rowAction: AndOr;
  onActionChange: (value: AndOr) => void;
  onAddCondition: () => void;
  children?: React.ReactNode;
}

export const ExpressionGroup: FunctionComponent<ExpressionGroupProps> = React.memo(
  ({ parentAction, rowAction, groupKey, group, children, onActionChange, onAddCondition }) => {
    const { ref: dropRef, isDropTarget } = useDroppable({
      id: groupKey,
      accept: 'row',
      collisionPriority: ROW_DROP_PRIORITY_GROUP,
      data: { type: 'group', groupKey } satisfies RowDropTarget,
    });
    const { source } = useDragOperation();
    // Only highlight when the dragged row comes from a different group (or the root level).
    const sourceRow = source?.data as DraggableRow | undefined;
    const isValidDropTarget = isDropTarget && sourceRow?.groupKey !== groupKey;

    return (
      <li
        ref={dropRef}
        className={classNames('slds-expression__group', {
          'drop-zone-border': isValidDropTarget,
        })}
      >
        <fieldset>
          <legend className="slds-expression__legend slds-expression__legend_group">
            <span>{parentAction}</span>
            <span className="slds-assistive-text">{`Condition Group ${group}`}</span>
          </legend>
          <ExpressionActionDropDown label="" value={rowAction || 'AND'} onChange={onActionChange} />
          {children}
          <div className="slds-expression__buttons">
            <button className="slds-button slds-button_neutral" onClick={() => onAddCondition()}>
              <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
              Add Condition
            </button>
          </div>
        </fieldset>
      </li>
    );
  },
);

export default ExpressionGroup;
