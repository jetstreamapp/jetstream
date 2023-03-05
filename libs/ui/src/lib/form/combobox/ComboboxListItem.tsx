import { SerializedStyles } from '@emotion/react';
import { Maybe } from '@jetstream/types';
import classNames from 'classnames';
import React, { forwardRef, Fragment } from 'react';
import Icon from '../../widgets/Icon';

export interface ComboboxListItemProps {
  id: string;
  className?: string;
  containerCss?: SerializedStyles;
  textContainerClassName?: string;
  textClassName?: string;
  textBodyCss?: SerializedStyles;
  textCss?: SerializedStyles;
  label?: string; // can pass in children instead to override the complete media body
  secondaryLabel?: Maybe<string>;
  secondaryLabelOnNewLine?: Maybe<boolean>;
  title?: string; // fallback to label is label is a string
  selected: boolean;
  disabled?: boolean;
  hasError?: boolean;
  placeholder?: boolean;
  onSelection: (id: string) => void;
  children?: React.ReactNode; // required because forwardRef
}

export const ComboboxListItem = forwardRef<HTMLLIElement, ComboboxListItemProps>(
  (
    {
      id,
      className,
      containerCss,
      textContainerClassName,
      textClassName,
      textBodyCss,
      textCss,
      label,
      secondaryLabel,
      secondaryLabelOnNewLine,
      title,
      selected,
      disabled,
      hasError,
      placeholder,
      onSelection,
      children,
    },
    ref
  ) => {
    const backupTitle = `${label || ''} ${secondaryLabel || ''}`;
    title = title || backupTitle;
    return (
      <li
        ref={ref}
        role="presentation"
        className={classNames('slds-listbox__item slds-item', className)}
        onClick={() => onSelection(id)}
        tabIndex={-1}
        css={containerCss}
      >
        <div
          id={id}
          aria-disabled={disabled}
          className={classNames(
            'slds-media slds-listbox__option slds-listbox__option_plain',
            {
              'slds-is-selected': selected,
              'slds-text-color_error': hasError,
              'slds-media_small': !placeholder,
            },
            textContainerClassName
          )}
          role="option"
          aria-selected={selected}
        >
          {!placeholder && (
            <span className="slds-media__figure slds-listbox__option-icon">
              {selected && (
                <Icon
                  type="utility"
                  icon="check"
                  className="slds-icon slds-icon_x-small"
                  containerClassname={classNames('slds-icon_container slds-icon-utility-check slds-current-color', {
                    'slds-icon_disabled': disabled,
                  })}
                />
              )}
            </span>
          )}
          <span
            className={classNames({
              'slds-media__body': !placeholder,
            })}
            css={textBodyCss}
          >
            {label && (!secondaryLabel || !secondaryLabelOnNewLine) && (
              <span className={classNames('slds-truncate', textClassName)} title={title} css={textCss}>
                {label}
                {secondaryLabel && <span className="slds-text-color_weak slds-m-left_xx-small">{secondaryLabel}</span>}
              </span>
            )}
            {label && secondaryLabel && secondaryLabelOnNewLine && (
              <Fragment>
                <span className="slds-listbox__option-text slds-listbox__option-text_entity">{label}</span>
                <span className="slds-listbox__option-meta slds-listbox__option-meta_entity">{secondaryLabel}</span>
              </Fragment>
            )}
            {children}
          </span>
        </div>
      </li>
    );
  }
);
