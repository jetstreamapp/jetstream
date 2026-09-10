import { css } from '@emotion/react';
import { SFDC_OBJECT_TAB_ICONS } from '@jetstream/shared/assets';
import { Maybe } from '@jetstream/types';
import classNames from 'classnames';

export interface TabIconListProps {
  selectedItem?: Maybe<string>;
  disabled?: boolean;
  onSelected: (selectedItem: string) => void;
}

export const TabIconList = ({ selectedItem, disabled, onSelected }: TabIconListProps) => {
  return (
    <>
      {SFDC_OBJECT_TAB_ICONS.map(({ id, url }) => (
        <button
          key={id}
          type="button"
          className={classNames('slds-button slds-button_icon slds-button_icon-border-filled slds-m-around_xx-small', {
            'slds-is-selected': id === selectedItem,
          })}
          aria-pressed={id === selectedItem ? 'true' : undefined}
          title={id}
          onClick={() => !disabled && onSelected(id)}
          disabled={disabled}
        >
          <img
            className="slds-button__icon"
            css={css`
              width: 32px;
              height: 32px;
              padding: 5px;
            `}
            src={url}
            alt={id}
          />
          <span className="slds-assistive-text">{id}</span>
        </button>
      ))}
    </>
  );
};

export default TabIconList;
