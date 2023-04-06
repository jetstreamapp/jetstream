import { SerializedStyles } from '@emotion/react';
import { useCombinedRefs } from '@jetstream/shared/ui-utils';
import { Maybe } from '@jetstream/types';
import classNames from 'classnames';
import React, { forwardRef, Fragment, useEffect, useRef } from 'react';
import Icon from '../../widgets/Icon';

export interface ComboboxListItemProps {
  id: string;
  className?: string;
  containerCss?: SerializedStyles;
  textContainerClassName?: string;
  textClassName?: string;
  textBodyCss?: SerializedStyles;
  textCss?: SerializedStyles;
  /**
   * can pass in children instead to override the complete body of the list item
   */
  label?: string;
  secondaryLabel?: Maybe<string>;
  secondaryLabelOnNewLine?: Maybe<boolean>;
  tertiaryLabel?: Maybe<string>;
  /**
   * If true, will show icon to indicate child items shown after selected
   */
  isDrillInItem?: boolean;
  /**
   * fallback to label if label is not a string
   */
  title?: string;
  selected: boolean;
  disabled?: boolean;
  hasError?: boolean;
  /** Set to true for a placeholder to show if there are no items in the list */
  placeholder?: boolean;
  /** If changed and is true, will auto-focus */
  focused?: boolean;
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
      tertiaryLabel,
      isDrillInItem,
      title,
      selected,
      disabled,
      hasError,
      placeholder,
      focused,
      onSelection,
      children,
    },
    ref
  ) => {
    const innerRef = useRef<HTMLLIElement>(ref as any);
    const combinedRef = useCombinedRefs<HTMLLIElement>(ref, innerRef);

    useEffect(() => {
      if (focused) {
        combinedRef.current?.focus();
      }
    }, [combinedRef, focused]);

    const backupTitle = `${label || ''} ${secondaryLabel || ''}`;
    title = title || backupTitle;
    return (
      <li
        ref={combinedRef}
        role="presentation"
        className={classNames('slds-listbox__item slds-item', className)}
        onClick={() => onSelection(id)}
        tabIndex={-1}
        css={containerCss}
        data-type={isDrillInItem ? 'drill-in' : 'item'}
      >
        <div
          id={id}
          aria-disabled={disabled}
          className={classNames(
            'slds-listbox__option slds-media slds-media_center',
            {
              'slds-listbox__option_entity': isDrillInItem,
              'slds-is-selected': selected,
              'slds-text-color_error': hasError,
              'slds-listbox__option_plain': !isDrillInItem && !secondaryLabelOnNewLine,
              'slds-media_center slds-listbox__option_entity': !placeholder && secondaryLabelOnNewLine && secondaryLabel,
              'slds-media_small': !placeholder && !secondaryLabelOnNewLine,
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
            className={classNames('slds-text-body_small', {
              'slds-media__body': !placeholder,
            })}
            css={textBodyCss}
          >
            {label && (!secondaryLabel || !secondaryLabelOnNewLine) && (
              <span className={classNames('slds-truncate', textClassName)} title={title} css={textCss}>
                <span>{label}</span>
                {secondaryLabel && <span className="slds-text-color_weak slds-m-left_xx-small">{secondaryLabel}</span>}
                {tertiaryLabel && (
                  <span className="slds-listbox__option-meta slds-listbox__option-meta_entity">
                    <div className="slds-truncate">
                      <strong>{tertiaryLabel}</strong>
                    </div>
                  </span>
                )}
              </span>
            )}
            {label && secondaryLabel && secondaryLabelOnNewLine && (
              <Fragment>
                <div className="slds-listbox__option-text slds-listbox__option-text_entity">{label}</div>
                <div className="slds-listbox__option-meta slds-listbox__option-meta_entity slds-truncate" title={secondaryLabel}>
                  {secondaryLabel}
                </div>
                {tertiaryLabel && (
                  <span className="slds-listbox__option-meta slds-listbox__option-meta_entity">
                    <div className="slds-truncate">
                      <strong>{tertiaryLabel}</strong>
                    </div>
                  </span>
                )}
              </Fragment>
            )}
            {children}
          </span>
          {isDrillInItem && (
            <span className="slds-media__figure">
              <Icon
                type="utility"
                icon="chevronright"
                className="slds-icon slds-icon-text-default slds-icon_xx-small"
                description="Has further options"
              />
            </span>
          )}
        </div>
      </li>
    );
  }
);
