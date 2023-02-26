import { AndOr } from '@jetstream/types';
import classNames from 'classnames';
import React, { FunctionComponent } from 'react';
import { useDrop } from 'react-dnd';
import Icon from '../widgets/Icon';
import { DraggableRow } from './expression-types';
import ExpressionActionDropDown from './ExpressionActionDropDown';

export interface ExpressionGroupProps {
  groupKey: number;
  group: number;
  parentAction: AndOr;
  rowAction: AndOr;
  onActionChange: (value: AndOr) => void;
  onAddCondition: () => void;
  moveRowToGroup: (item: DraggableRow, targetGroup: number) => void;
  children?: React.ReactNode;
}

export const ExpressionGroup: FunctionComponent<ExpressionGroupProps> = React.memo(
  ({ parentAction, rowAction, groupKey, group, children, onActionChange, onAddCondition, moveRowToGroup }) => {
    const [{ isOver, canDrop }, drop] = useDrop({
      accept: 'row',
      collect: (monitor) => ({
        isOver: monitor.isOver({ shallow: true }),
        canDrop: monitor.getItem<DraggableRow>()?.groupKey !== groupKey,
      }),
      canDrop: (item: DraggableRow, monitor) => item?.groupKey !== groupKey,
      drop: (item: DraggableRow, monitor) => {
        moveRowToGroup(item, groupKey);
      },
    });

    return (
      <li
        ref={drop}
        className={classNames('slds-expression__group', {
          'drop-zone-border': isOver && canDrop,
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
  }
);

export default ExpressionGroup;
