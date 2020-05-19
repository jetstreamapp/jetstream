import React, { FunctionComponent } from 'react';

export interface TextareaProps {
  id: string;
  label?: string;
}

export const Textarea: FunctionComponent<TextareaProps> = ({ id, label, children }) => {
  return (
    <div className="slds-form-element">
      {label && (
        <label className="slds-form-element__label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="slds-form-element__control">{children}</div>
    </div>
  );
};

export default Textarea;
