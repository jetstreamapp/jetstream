/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { FunctionComponent } from 'react';

export interface ItemSelectionTextProps {
  selected: number;
  onClick: () => void;
}

export const ItemSelectionText: FunctionComponent<ItemSelectionTextProps> = ({ selected, onClick }) => {
  return (
    <div
      css={css`
        min-height: 20px;
      `}
    >
      {formatNumber(selected)} {pluralizeFromNumber('object', selected)} selected{' '}
      {selected > 0 && (
        <button className="slds-button slds-text-link_reset slds-text-link" onClick={() => onClick()}>
          Clear
        </button>
      )}
    </div>
  );
};

export default ItemSelectionText;
