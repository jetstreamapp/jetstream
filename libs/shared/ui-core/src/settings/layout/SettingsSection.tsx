import { css } from '@emotion/react';
import { CheckboxToggle } from '@jetstream/ui';
import { ReactNode } from 'react';

// Sections receive focus when picked from the settings navigation - the outline only shows for keyboard focus
const sectionCss = css`
  scroll-margin-top: 1rem;
  border-radius: 0.5rem;

  &:focus:not(:focus-visible) {
    outline: none;
  }

  &:focus-visible {
    outline: 2px solid var(--slds-g-color-brand-base-50, #0176d3);
    outline-offset: 0.5rem;
  }
`;

const groupStackCss = css`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 0.75rem;
`;

const groupCss = css`
  border: 1px solid var(--slds-g-color-border-1, #e5e5e5);
  border-radius: 0.5rem;
  background-color: var(--slds-g-color-surface-container-1, #fff);

  & > * + * {
    border-top: 1px solid var(--slds-g-color-border-1, #e5e5e5);
  }
`;

const dangerGroupCss = css`
  border-color: var(--slds-g-color-error-base-40, #ea001e);
`;

const groupHeaderCss = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
`;

const rowCss = css`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem 2rem;
  padding: 0.875rem 1.25rem;

  @media (max-width: 40em) {
    flex-direction: column;
    align-items: stretch;
  }
`;

const stackedRowCss = css`
  flex-direction: column;
  align-items: stretch;
`;

const rowTextCss = css`
  flex: 1 1 auto;
  min-width: 0;
`;

const rowTitleCss = css`
  display: block;
  font-size: 0.875rem;
  font-weight: 600;
`;

// Controls keep their natural width (the text wraps instead) and only wrap onto more lines when there are
// several of them. Relative so a busy <Spinner /> placed with the controls covers just the controls.
const rowControlCss = css`
  position: relative;
  flex: 0 0 auto;
  max-width: 65%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;

  .slds-button {
    white-space: nowrap;
  }

  @media (max-width: 40em) {
    max-width: none;
    justify-content: flex-start;
  }
`;

const stackedRowControlCss = css`
  max-width: none;
  justify-content: flex-start;
`;

export function getSettingsRowIds(id: string) {
  return { titleId: `${id}-title`, descriptionId: `${id}-description` };
}

export interface SettingsSectionProps {
  /** Anchor target for the settings navigation */
  id: string;
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

/** Top level settings category - one entry in the settings navigation, holding one or more `SettingsGroup`s */
export const SettingsSection = ({ id, title, description, children }: SettingsSectionProps) => {
  const headingId = `${id}-heading`;
  return (
    // Focusable so navigating to a section moves focus into it (see SettingsLayout)
    <section id={id} aria-labelledby={headingId} tabIndex={-1} css={sectionCss}>
      <h2 id={headingId} className="slds-text-heading_medium">
        {title}
      </h2>
      {description && <p className="slds-text-color_weak slds-m-top_xx-small">{description}</p>}
      <div css={groupStackCss}>{children}</div>
    </section>
  );
};

export interface SettingsGroupProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Rendered on the right side of the group header */
  actions?: ReactNode;
  variant?: 'default' | 'danger';
  testId?: string;
  children: ReactNode;
}

/** Bordered card of `SettingsRow`s, with an optional header */
export const SettingsGroup = ({ title, description, actions, variant = 'default', testId, children }: SettingsGroupProps) => {
  return (
    <div css={[groupCss, variant === 'danger' && dangerGroupCss]} data-testid={testId}>
      {(title || actions) && (
        <div css={groupHeaderCss}>
          <div>
            {title && (
              <h3 className={variant === 'danger' ? 'slds-text-heading_small slds-text-color_destructive' : 'slds-text-heading_small'}>
                {title}
              </h3>
            )}
            {description && <p className="slds-text-color_weak slds-m-top_xxx-small">{description}</p>}
          </div>
          {actions && <div css={rowControlCss}>{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

export interface SettingsRowProps {
  /** Base for the title and description element ids, so controls can reference them */
  id: string;
  title: ReactNode;
  /** Renders the title as a `<label>` for this form control id */
  labelFor?: string;
  description?: ReactNode;
  /** Additional content under the description, such as a status line or a link */
  details?: ReactNode;
  /** Places the controls under the text instead of beside it, for wide content */
  stacked?: boolean;
  /** The row's controls */
  children?: ReactNode;
}

/** One setting: title and description on the left, its controls on the right */
export const SettingsRow = ({ id, title, labelFor, description, details, stacked = false, children }: SettingsRowProps) => {
  const { titleId, descriptionId } = getSettingsRowIds(id);
  return (
    <div css={[rowCss, stacked && stackedRowCss]}>
      <div css={rowTextCss}>
        {labelFor ? (
          <label id={titleId} htmlFor={labelFor} css={rowTitleCss}>
            {title}
          </label>
        ) : (
          <span id={titleId} css={rowTitleCss}>
            {title}
          </span>
        )}
        {description && (
          <div id={descriptionId} className="slds-text-color_weak slds-m-top_xxx-small">
            {description}
          </div>
        )}
        {details && <div className="slds-m-top_x-small">{details}</div>}
      </div>
      {children && <div css={[rowControlCss, stacked && stackedRowControlCss]}>{children}</div>}
    </div>
  );
};

export interface SettingsToggleRowProps {
  id: string;
  title: string;
  description?: ReactNode;
  details?: ReactNode;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

export const SettingsToggleRow = ({ id, title, description, details, checked, disabled, onChange }: SettingsToggleRowProps) => {
  const { descriptionId } = getSettingsRowIds(id);
  return (
    <SettingsRow id={id} title={title} description={description} details={details}>
      {/* The row already shows the title and state, so the toggle's own label and captions are screen reader only */}
      <CheckboxToggle
        id={id}
        label={title}
        hideLabel
        onText=""
        offText=""
        checked={checked}
        disabled={disabled}
        ariaDescribedBy={description ? descriptionId : undefined}
        onChange={onChange}
      />
    </SettingsRow>
  );
};
