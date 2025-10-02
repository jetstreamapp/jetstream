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
    background: #2e844a;
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
  }

  .toggle-wrapper {
    position: relative;
    background: #f3f3f3;
    border-radius: 24px;
    padding: 4px;
    display: flex;
    align-items: center;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  .toggle-option {
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 14px;
    font-weight: 500;
    color: #706e6b;
    transition: all 0.2s ease;
    cursor: pointer;
    position: relative;
    z-index: 2;
    min-width: 80px;
    text-align: center;
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
    background: #0176d3;
    border-radius: 20px;
    transition: transform 0.2s ease;
    z-index: 1;
  }

  .toggle-slider.annual {
    transform: translateX(100%);
  }
`;

export const BillingPeriodToggle = ({ isAnnual, onChange }: BillingPeriodToggleProps) => {
  return (
    <div css={toggleStyles}>
      <div className="billing-toggle-wrapper">
        <div className={`savings-badge ${isAnnual ? 'visible' : ''}`}>Get two months free</div>
        <div className="billing-toggle-container">
          <div className="toggle-wrapper" onClick={() => onChange(!isAnnual)}>
            <div className={`toggle-slider ${isAnnual ? 'annual' : ''}`} />
            <div
              className={`toggle-option ${!isAnnual ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onChange(false);
              }}
            >
              Monthly
            </div>
            <div
              className={`toggle-option ${isAnnual ? 'active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onChange(true);
              }}
            >
              Annual
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
