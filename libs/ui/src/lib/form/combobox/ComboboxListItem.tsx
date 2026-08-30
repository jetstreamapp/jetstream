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
 * The suffix sits on its own row beneath the text rather than beside it. Alongside the label it could
 * not shrink, so a row carrying more than one badge squeezed the label into a column a few characters
 * wide - and `allowWrap` then broke an org username apart one character per line. On its own row both
 * the label and the badges get the full width of the list.
 */
const labelSuffixRowCss = css`
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.5rem;
  margin-top: 0.25rem;

  /* SLDS spaces adjacent badges with a margin, which would both compound with the gap and indent the
     first badge of a wrapped line. The gap owns the spacing here so it stays even in both directions. */
  .slds-badge + .slds-badge {
    margin-left: 0;
  }
`;

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
   * Rendered on its own row beneath the label, outside of the truncating/wrapping text flow.
   * Intended for status indicators such as badges.
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
        onClick={() => onSelection(id)}
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
            )}
            {label && secondaryLabel && secondaryLabelOnNewLine && (
              <Fragment>
                <div className="slds-listbox__option-text slds-listbox__option-text_entity" css={wrapCss}>
                  {label}
                </div>
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
            {labelSuffix && <div css={labelSuffixRowCss}>{labelSuffix}</div>}
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
