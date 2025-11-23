import { AndOr } from '@jetstream/types';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { useDrop } from 'react-dnd';
import Icon from '../widgets/Icon';
import { DraggableRow } from './expression-types';
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
  moveRowToGroup: (item: DraggableRow) => void;
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
  moveRowToGroup,
}) => {
  const [{ isOver, canDrop }, drop] = useDrop(
    {
      accept: 'row',
      collect: (monitor) => {
        return {
          isOver: monitor.isOver({ shallow: true }),
          canDrop: !!monitor.getItem<DraggableRow>()?.groupKey,
        };
      },
      canDrop: (item: DraggableRow, monitor) => {
        return monitor.isOver({ shallow: true }) && !!item?.groupKey;
      },
      drop: (item: DraggableRow, monitor) => {
        moveRowToGroup(item);
      },
    },
    [],
  );

  return (
    <div className="slds-expression">
      {title && <h2 className="slds-expression__title">{title}</h2>}
      <div
        className={classNames({
          'drop-zone-border': isOver && canDrop,
        })}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ref={drop as any}
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
