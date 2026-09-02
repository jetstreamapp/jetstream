import { css } from '@emotion/react';

interface BillingPeriodToggleProps {
  isAnnual: boolean;
  onChange: (isAnnual: boolean) => void;
}

const toggleStyles = css`
  .billing-toggle-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 32px;
    gap: 8px;
  }

  .savings-badge {
    background: var(--slds-g-color-success-base-50, #2e844a);
    color: white;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .savings-badge.visible {
    opacity: 1;
  }

  .billing-toggle-container {
    display: flex;
    align-items: center;
    justify-content: center;
    /* fieldset reset */
    border: 0;
    margin: 0;
    padding: 0;
    min-width: 0;
  }

  .toggle-wrapper {
    position: relative;
    background: var(--slds-g-color-surface-2, #f3f3f3);
    border-radius: 24px;
    padding: 4px;
    display: flex;
    align-items: center;
    transition: background 0.2s ease;
  }

  .toggle-option {
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 500;
    color: var(--slds-g-color-on-surface-1, #706e6b);
    transition: all 0.2s ease;
    cursor: pointer;
    position: relative;
    z-index: 2;
    min-width: 80px;
    text-align: center;
  }

  /* The radio itself is visually hidden — show its keyboard focus on the option label */
  .toggle-option:has(input:focus-visible) {
    outline: 2px solid var(--slds-g-color-brand-base-50, #0176d3);
    outline-offset: 2px;
  }

  .toggle-option.active {
    color: white;
  }

  .toggle-slider {
    position: absolute;
    top: 4px;
    left: 4px;
    width: calc(50% - 4px);
    height: calc(100% - 8px);
    background: var(--slds-g-color-brand-base-50, #0176d3);
    border-radius: 20px;
    transition: transform 0.2s ease;
    z-index: 1;
  }

  .toggle-slider.annual {
    transform: translateX(100%);
  }
`;

/**
 * Monthly / Annual switch. Semantically a two-option radio group (arrow keys move between the
 * options, Tab enters and leaves the group once) dressed as a sliding toggle — the radios are
 * visually hidden inside their option labels.
 */
export const BillingPeriodToggle = ({ isAnnual, onChange }: BillingPeriodToggleProps) => {
  return (
    <div css={toggleStyles}>
      <div className="billing-toggle-wrapper">
        <div className={`savings-badge ${isAnnual ? 'visible' : ''}`}>Get two months free</div>
        <fieldset className="billing-toggle-container">
          <legend className="slds-assistive-text">Billing period</legend>
          <div className="toggle-wrapper">
            <div className={`toggle-slider ${isAnnual ? 'annual' : ''}`} aria-hidden="true" />
            <label className={`toggle-option ${!isAnnual ? 'active' : ''}`}>
              <input
                type="radio"
                name="billing-period"
                value="monthly"
                className="slds-assistive-text"
                checked={!isAnnual}
                onChange={() => onChange(false)}
              />
              Monthly
            </label>
            <label className={`toggle-option ${isAnnual ? 'active' : ''}`}>
              <input
                type="radio"
                name="billing-period"
                value="annual"
                className="slds-assistive-text"
                checked={isAnnual}
                onChange={() => onChange(true)}
              />
              Annual
            </label>
          </div>
        </fieldset>
      </div>
    </div>
  );
};
