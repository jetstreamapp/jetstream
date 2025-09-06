import { css } from '@emotion/react';
import { StripePriceKey } from '@jetstream/types';
import { Icon } from '@jetstream/ui';
import classNames from 'classnames';
import { useId } from 'react';

interface EnhancedBillingCardProps {
  planName: string;
  price: string;
  priceSubtext?: string;
  description?: string;
  features: string[];
  comingSoonFeatures?: string[];
  isEnterprise?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  value?: StripePriceKey;
  checked?: boolean;
  onChange?: (value: StripePriceKey) => void;
  onEnterpriseContact?: () => void;
}

const cardStyles = css`
  .billing-card {
    position: relative;
    border: 2px solid #d8dde6;
    border-radius: 8px;
    background: white;
    transition: all 0.2s ease;
    cursor: pointer;
    height: 100%;
    display: flex;
    flex-direction: column;

    &:hover {
      border-color: #0176d3;
      box-shadow: 0 4px 8px rgba(1, 118, 211, 0.1);
    }

    &.selected {
      border-color: #0176d3;
      box-shadow: 0 4px 12px rgba(1, 118, 211, 0.2);
    }

    &.enterprise {
      cursor: default;

      &:hover {
        border-color: #d8dde6;
        box-shadow: none;
      }
    }

    &.disabled {
      opacity: 0.6;
      cursor: default;

      &:hover {
        border-color: #d8dde6;
        box-shadow: none;
      }
    }
  }

  .card-header {
    text-align: center;
    padding: 24px 24px 16px;
  }

  .plan-name {
    font-size: 20px;
    font-weight: 600;
    color: #16325c;
    margin-bottom: 8px;
  }

  .price {
    font-size: 36px;
    font-weight: 700;
    color: #0176d3;
    line-height: 1;
  }

  .price-subtext {
    font-size: 14px;
    color: #706e6b;
    margin-top: 4px;
  }

  .description {
    font-size: 14px;
    color: #706e6b;
    margin-top: 8px;
  }

  .features-section {
    padding: 16px 24px 24px;
    border-top: 1px solid #f3f3f3;
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .features-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .feature-item {
    display: flex;
    align-items: flex-start;
    margin-bottom: 12px;
    font-size: 14px;
    color: #444;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .feature-icon {
    margin-right: 8px;
    margin-top: 2px;
    flex-shrink: 0;
  }

  .bottom-section {
    padding: 24px;
    text-align: center;
    margin-top: auto;

    .enterprise-button {
      background: #16325c;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s ease;

      &:hover {
        background: #0f2040;
      }
    }
  }

  .disabled-reason {
    font-size: 12px;
    opacity: 1;
  }

  .radio-input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .selected-indicator {
    position: absolute;
    top: 12px;
    right: 12px;
    background: #0176d3;
    border-radius: 50%;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s ease;
  }

  .selected .selected-indicator {
    opacity: 1;
  }

  .coming-soon-features {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px dashed #d8dde6;
  }

  .coming-soon-features h4 {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #706e6b;
    margin: 0 0 12px 0;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .coming-soon-features .feature-item {
    color: #706e6b;
    font-style: italic;
    position: relative;
  }
`;

export const EnhancedBillingCard = ({
  planName,
  price,
  priceSubtext,
  description,
  features,
  comingSoonFeatures,
  isEnterprise = false,
  disabled = false,
  disabledReason,
  value,
  checked = false,
  onChange,
  onEnterpriseContact,
}: EnhancedBillingCardProps) => {
  const id = useId();

  const handleCardClick = () => {
    if (disabled || isEnterprise) {
      return;
    }

    if (value && onChange) {
      onChange(value);
    }
  };

  return (
    <div css={cardStyles}>
      <div
        className={classNames('billing-card', {
          selected: checked,
          enterprise: isEnterprise,
          disabled,
        })}
        onClick={handleCardClick}
      >
        {!isEnterprise && (
          <input
            type="radio"
            id={id}
            value={value}
            checked={checked}
            name="priceId"
            disabled={disabled}
            onChange={(ev) => onChange?.(ev.target.value as StripePriceKey)}
            className="radio-input"
          />
        )}

        <div className="card-header">
          <div className="plan-name">{planName}</div>
          <div className="price">{price}</div>
          {priceSubtext && <div className="price-subtext">{priceSubtext}</div>}
          {description && <div className="description">{description}</div>}
        </div>

        <div className="features-section">
          <ul className="features-list">
            {features.map((feature, index) => (
              <li key={index} className="feature-item">
                <Icon
                  type="utility"
                  icon="check"
                  className="slds-icon slds-icon_x-small feature-icon"
                  containerClassname="slds-icon_container slds-icon-text-success"
                />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
          {comingSoonFeatures && comingSoonFeatures.length > 0 && (
            <div className="coming-soon-features">
              <h4>Coming Soon</h4>
              <ul className="features-list">
                {comingSoonFeatures.map((feature, index) => (
                  <li key={index} className="feature-item">
                    <Icon
                      type="utility"
                      icon="check"
                      className="slds-icon slds-icon_x-small feature-icon"
                      containerClassname="slds-icon_container slds-icon-text-default"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {disabled && disabledReason && <div className="bottom-section disabled-reason slds-text-color_error">{disabledReason}</div>}

        {isEnterprise && (
          <div className="bottom-section">
            <button
              type="button"
              className="enterprise-button"
              onClick={(e) => {
                e.stopPropagation();
                onEnterpriseContact?.();
              }}
            >
              Contact Sales
            </button>
          </div>
        )}

        {!isEnterprise && (
          <div className="selected-indicator">
            <Icon type="utility" icon="check" className="slds-icon slds-icon_xx-small" omitContainer />
          </div>
        )}
      </div>
    </div>
  );
};
