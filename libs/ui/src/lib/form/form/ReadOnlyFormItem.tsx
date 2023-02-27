import classNames from 'classnames';
import uniqueId from 'lodash/uniqueId';
import React, { FunctionComponent, ReactNode } from 'react';
import HelpText from '../../widgets/HelpText';
import { Icon } from '../../widgets/Icon';

export interface ReadOnlyFormItemProps {
  id?: string;
  className?: string;
  label: string | ReactNode;
  labelHelp?: string | null;
  isRequired?: boolean;
  horizontal?: boolean;
  fullWidth?: boolean;
  omitEdit?: boolean;
  onEditMore?: () => void;
  children?: React.ReactNode;
}

export const ReadOnlyFormItem: FunctionComponent<ReadOnlyFormItemProps> = ({
  id = uniqueId('ReadOnlyFormItem-'),
  className,
  label,
  labelHelp,
  isRequired,
  horizontal = false,
  fullWidth = false,
  omitEdit,
  onEditMore,
  children,
}) => {
  function handleOnEdit() {
    onEditMore && onEditMore();
  }

  const description = `Edit ${label}`;
  return (
    <div
      className={classNames(
        'slds-form-element slds-form-element_edit slds-form-element_readonly slds-hint-parent',
        {
          'slds-form-element_stacked': !horizontal,
          'slds-form-element_horizontal': horizontal,
          'slds-form-element_1-col': fullWidth,
        },
        className
      )}
    >
      <span className="slds-form-element__label">
        {isRequired && (
          <abbr className="slds-required" title="required">
            *{' '}
          </abbr>
        )}
        {label}
      </span>
      {labelHelp && <HelpText id={`${id}-label-help-text`} content={labelHelp} />}
      <div className="slds-form-element__control">
        <div className="slds-form-element__static">{children}</div>
        {!omitEdit && (
          <button className="slds-button slds-button_icon" title={description} onClick={handleOnEdit}>
            <Icon type="utility" icon="edit" omitContainer className="slds-button__icon slds-button__icon_hint" description={description} />
          </button>
        )}
      </div>
    </div>
  );
};

export default ReadOnlyFormItem;
