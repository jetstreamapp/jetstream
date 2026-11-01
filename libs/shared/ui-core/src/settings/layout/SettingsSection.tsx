import { css } from '@emotion/react';
import { CheckboxToggle } from '@jetstream/ui';
import { ReactNode } from 'react';
import { SettingsSearchScopeProvider, useSettingsSearch } from './settings-search';

// Sections receive focus when picked from the settings navigation - the outline only shows for keyboard focus
const sectionCss = css`
  scroll-margin-top: 1rem;
  border-radius: 0.5rem;

  /* Hidden by the settings search - the SLDS reset gives sections display: block, which would otherwise win */
  &[hidden] {
    display: none;
  }

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

  &[hidden] {
    display: none;
  }

  /* Rows hidden by the settings search are skipped, so the first visible row never gets a divider */
  & > :not([hidden]) ~ :not([hidden]) {
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

  &[hidden] {
    display: none;
  }

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
  /** Words that find this section in the settings search without being shown */
  keywords?: string[];
  children: ReactNode;
}

/** Top level settings category - one entry in the settings navigation, holding one or more `SettingsGroup`s */
export const SettingsSection = ({ id, title, description, keywords, children }: SettingsSectionProps) => {
  const headingId = `${id}-heading`;
  const { isVisible, scope, highlight } = useSettingsSearch({ reportKey: id, text: [title, description], keywords });
  return (
    // Focusable so navigating to a section moves focus into it (see SettingsLayout)
    <section id={id} aria-labelledby={headingId} tabIndex={-1} css={sectionCss} hidden={!isVisible}>
      <h2 id={headingId} className="slds-text-heading_medium">
        {highlight(title)}
      </h2>
      {description && <p className="slds-text-color_weak slds-m-top_xx-small">{highlight(description)}</p>}
      <SettingsSearchScopeProvider scope={scope}>
        <div css={groupStackCss}>{children}</div>
      </SettingsSearchScopeProvider>
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
  /** Content shown in the group outside of its rows that the settings search should also match (it is not highlighted) */
  searchText?: ReactNode[];
  /** Words that find this group in the settings search without being shown */
  keywords?: string[];
  children: ReactNode;
}

/** Bordered card of `SettingsRow`s, with an optional header */
export const SettingsGroup = ({
  title,
  description,
  actions,
  variant = 'default',
  testId,
  searchText = [],
  keywords,
  children,
}: SettingsGroupProps) => {
  const { isVisible, scope, highlight } = useSettingsSearch({ text: [title, description, ...searchText], keywords });
  return (
    <div css={[groupCss, variant === 'danger' && dangerGroupCss]} data-testid={testId} hidden={!isVisible}>
      {(title || actions) && (
        <div css={groupHeaderCss}>
          <div>
            {title && (
              <h3 className={variant === 'danger' ? 'slds-text-heading_small slds-text-color_destructive' : 'slds-text-heading_small'}>
                {highlight(title)}
              </h3>
            )}
            {description && <p className="slds-text-color_weak slds-m-top_xxx-small">{highlight(description)}</p>}
          </div>
          {actions && <div css={rowControlCss}>{actions}</div>}
        </div>
      )}
      <SettingsSearchScopeProvider scope={scope}>{children}</SettingsSearchScopeProvider>
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
  /** Words that find this setting in the settings search without being shown, e.g. "dark" for the theme */
  keywords?: string[];
  /** The row's controls */
  children?: ReactNode;
}

/** One setting: title and description on the left, its controls on the right */
export const SettingsRow = ({ id, title, labelFor, description, details, stacked = false, keywords, children }: SettingsRowProps) => {
  const { titleId, descriptionId } = getSettingsRowIds(id);
  // Details and control labels count towards a match but are left unhighlighted, so a search never re-renders the controls
  const { isVisible, highlight } = useSettingsSearch({ text: [title, description, details, children], keywords });
  return (
    <div css={[rowCss, stacked && stackedRowCss]} hidden={!isVisible}>
      <div css={rowTextCss}>
        {labelFor ? (
          <label id={titleId} htmlFor={labelFor} css={rowTitleCss}>
            {highlight(title)}
          </label>
        ) : (
          <span id={titleId} css={rowTitleCss}>
            {highlight(title)}
          </span>
        )}
        {description && (
          <div id={descriptionId} className="slds-text-color_weak slds-m-top_xxx-small">
            {highlight(description)}
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
  keywords?: string[];
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}

export const SettingsToggleRow = ({ id, title, description, details, keywords, checked, disabled, onChange }: SettingsToggleRowProps) => {
  const { descriptionId } = getSettingsRowIds(id);
  return (
    <SettingsRow id={id} title={title} description={description} details={details} keywords={keywords}>
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
