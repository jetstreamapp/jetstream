import { css, SerializedStyles } from '@emotion/react';
import { useCombinedRefs } from '@jetstream/shared/ui-utils';
import { Maybe } from '@jetstream/types';
import classNames from 'classnames';
import React, { forwardRef, Fragment, useEffect, useRef } from 'react';
import Icon from '../../widgets/Icon';

/**
 * Overrides the nowrap/ellipsis that SLDS bakes into `slds-truncate` and
 * `slds-listbox__option-text_entity`. `overflow-wrap: anywhere` is required because values like
 * Salesforce usernames are single unbroken tokens that `break-word` will not split.
 */
const allowWrapCss = css`
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
  overflow-wrap: anywhere;
`;

/**
 * Lays the label and its suffix out side-by-side. With no suffix there is nothing to lay out, so the
 * label is emitted as-is rather than adding a wrapper element to every combobox item in the app.
 */
const LabelRow: React.FunctionComponent<{ labelSuffix?: React.ReactNode; children: React.ReactNode }> = ({ labelSuffix, children }) => {
  if (!labelSuffix) {
    return <Fragment>{children}</Fragment>;
  }
  return (
    <div className="slds-grid slds-grid_align-spread slds-grid_vertical-align-center">
      {children}
      <div className="slds-m-left_x-small slds-no-flex">{labelSuffix}</div>
    </div>
  );
};

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
   * Rendered next to the label, outside of the truncating/wrapping text flow.
   * Intended for a short status indicator such as a badge.
   */
  labelSuffix?: React.ReactNode;
  /**
   * Let long values wrap onto additional lines instead of truncating with an ellipsis.
   * Applies to both the single-line and the stacked "entity" layouts.
   */
  allowWrap?: boolean;
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
      labelSuffix,
      allowWrap,
      title,
      selected,
      disabled,
      hasError,
      placeholder,
      focused,
      onSelection,
      children,
    },
    ref,
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const innerRef = useRef<HTMLLIElement>(ref as any);
    const combinedRef = useCombinedRefs<HTMLLIElement>(ref, innerRef);

    useEffect(() => {
      if (focused) {
        combinedRef.current?.focus();
      }
    }, [combinedRef, focused]);

    const backupTitle = `${label || ''} ${secondaryLabel || ''}`;
    title = title || backupTitle;
    const wrapCss = allowWrap ? allowWrapCss : undefined;
    return (
      // Keyboard activation (Enter/Space) and arrow navigation are handled once on the listbox
      // container (Combobox.handleListKeyDown); oxlint does not recognise interactive ARIA roles here
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events
      <li
        ref={combinedRef}
        // The li is the element that receives focus during arrow-key navigation, so it must carry
        // the option semantics — with role="presentation" here, screen readers announced nothing
        role="option"
        aria-selected={selected}
        aria-disabled={disabled}
        className={classNames('slds-listbox__item slds-item', className)}
        // aria-disabled announces the state but does not block activation — guard it here
        onClick={() => !disabled && onSelection(id)}
        tabIndex={-1}
        css={[
          css`
            &:focus-visible {
              outline: 2px solid var(--slds-g-color-brand-base-50, #0176d3);
              outline-offset: -2px;
            }
          `,
          containerCss,
        ]}
        data-type={isDrillInItem ? 'drill-in' : 'item'}
      >
        <div
          id={id}
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
            textContainerClassName,
          )}
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
              <LabelRow labelSuffix={labelSuffix}>
                <span className={classNames({ 'slds-truncate': !allowWrap }, textClassName)} title={title} css={[wrapCss, textCss]}>
                  <span>{label}</span>
                  {secondaryLabel && <span className="slds-text-color_weak slds-m-left_xx-small">{secondaryLabel}</span>}
                  {tertiaryLabel && (
                    <span className="slds-listbox__option-meta">
                      <div className="slds-truncate">
                        <strong>{tertiaryLabel}</strong>
                      </div>
                    </span>
                  )}
                </span>
              </LabelRow>
            )}
            {label && secondaryLabel && secondaryLabelOnNewLine && (
              <Fragment>
                <LabelRow labelSuffix={labelSuffix}>
                  <div className="slds-listbox__option-text slds-listbox__option-text_entity" css={wrapCss}>
                    {label}
                  </div>
                </LabelRow>
                <div className="slds-listbox__option-meta">
                  <div className={classNames({ 'slds-truncate': !allowWrap })} title={secondaryLabel} css={wrapCss}>
                    {secondaryLabel}
                  </div>
                </div>
                {tertiaryLabel && (
                  <span
                    className="slds-listbox__option-meta"
                    css={css`
                      margin-top: 0.125rem;
                    `}
                  >
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
  },
);
