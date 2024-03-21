import { SizeXSmallSmallMediumLarge } from '@jetstream/types';
import classNames from 'classnames';
import React, { FunctionComponent, RefObject } from 'react';
import HelpText from '../../widgets/HelpText';

export interface SliderProps {
  inputRef?: RefObject<HTMLInputElement>;
  id: string;
  className?: string;
  sliderClassName?: string;
  size?: SizeXSmallSmallMediumLarge;
  value: string;
  label: string;
  rangeLabel: string;
  hideLabel?: boolean;
  labelHelp?: string | JSX.Element | null;
  helpText?: React.ReactNode | string;
  disabled?: boolean;
  readOnly?: boolean;
  hasError?: boolean;
  vertical?: boolean;
  min?: number;
  max?: number;
  step?: number;
  errorMessageId?: string;
  errorMessage?: React.ReactNode | string;
  onChange?: (value: string) => void;
}

export const Slider: FunctionComponent<SliderProps> = ({
  inputRef,
  id,
  className,
  sliderClassName,
  size,
  value,
  label,
  rangeLabel,
  hideLabel,
  labelHelp,
  helpText,
  hasError = false,
  vertical,
  errorMessageId,
  errorMessage,
  min,
  max,
  step,
  disabled = false,
  readOnly = false,
  onChange,
}) => {
  // TODO: value state
  const sizeClass = size ? `slds-size_${size}` : undefined;
  return (
    <div className={classNames('slds-form-element', className, { 'slds-has-error': hasError })}>
      <label className="slds-form-element__label" htmlFor={id}>
        <span className={classNames('slds-slider-label__label', { 'sr-only': hideLabel || !label })}>{label}</span>
        <span className={classNames('slds-slider-label__range', { 'sr-only': hideLabel || !rangeLabel })}>{rangeLabel}</span>
      </label>
      {labelHelp && !hideLabel && <HelpText id={`${id}-label-help-text`} content={labelHelp} />}
      <div className="slds-form-element__control">
        <div
          className={classNames(
            'slds-slider',
            sizeClass,
            {
              'slds-slider_vertical': vertical,
            },
            sliderClassName
          )}
        >
          <input
            ref={inputRef}
            className="slds-slider__range"
            type="range"
            id={id}
            value={value}
            disabled={readOnly || disabled}
            readOnly={readOnly}
            aria-describedby={errorMessageId}
            min={min}
            max={max}
            step={step}
            onChange={(event) => onChange && onChange(event.target.value)}
          />
          <span className="slds-slider__value" aria-hidden="true">
            {value}
          </span>
        </div>
      </div>
      {helpText && <div className="slds-form-element__help">{helpText}</div>}
      {hasError && errorMessage && (
        <div className="slds-form-element__help" id={errorMessageId}>
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default Slider;
