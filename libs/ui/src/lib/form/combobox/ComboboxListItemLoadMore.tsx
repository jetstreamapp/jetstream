import React, { FunctionComponent } from 'react';
import Spinner from '../../widgets/Spinner';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ComboboxListItemLoadMoreProps {}

export const ComboboxListItemLoadMore: FunctionComponent<ComboboxListItemLoadMoreProps> = () => {
  return (
    <li role="presentation" className="slds-listbox__item">
      <div className="slds-align_absolute-center slds-p-top_medium">
        <Spinner className="slds-spinner slds-spinner_brand slds-spinner_x-small slds-spinner_inline" hasContainer={false} />
        {/* <div role="status" className="slds-spinner slds-spinner_x-small slds-spinner_inline">
          <span className="slds-assistive-text">Loading</span>
          <div className="slds-spinner__dot-a"></div>
          <div className="slds-spinner__dot-b"></div>
        </div> */}
      </div>
    </li>
  );
};
