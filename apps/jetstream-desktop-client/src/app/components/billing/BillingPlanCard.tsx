import { Icon } from '@jetstream/ui';
import { ReactNode, useId } from 'react';

interface BillingPlanCardProps {
  description?: ReactNode;
  descriptionTitle?: string;
  price: string;
  priceDescription: string;
  disabled?: boolean;
  value?: string;
  checked?: boolean;
  onChange?: (value: string) => void;
}

export const BillingPlanCard = ({
  description,
  descriptionTitle,
  price,
  priceDescription,
  value,
  checked,
  disabled,
  onChange,
}: BillingPlanCardProps) => {
  const id = useId();

  return (
    <div className="slds-visual-picker slds-visual-picker_medium">
      <input
        type="radio"
        id={id}
        value={value}
        checked={checked}
        name="priceId"
        disabled={disabled}
        onChange={(ev) => onChange?.(ev.target.value)}
      />
      <label htmlFor={id}>
        <span className="slds-visual-picker__figure slds-visual-picker__text slds-align_absolute-center">
          <span>
            <span className="slds-text-heading_large">{price}</span>
            <span className="slds-text-title">{priceDescription}</span>
          </span>
        </span>
        {(descriptionTitle || description) && (
          <span className="slds-visual-picker__body">
            {descriptionTitle && <span className="slds-text-heading_small">{descriptionTitle}</span>}
            {description && <span className="slds-text-title">{description}</span>}
          </span>
        )}
        <Icon
          type="utility"
          icon="check"
          containerClassname="slds-icon_container slds-visual-picker__text-check"
          className="slds-icon slds-icon-text-check slds-icon_x-small"
        />
      </label>
    </div>
  );
};

export default BillingPlanCard;
