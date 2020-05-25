/** @jsx jsx */
import { jsx } from '@emotion/core';
import { FunctionComponent } from 'react';
import Icon from '../../widgets/Icon';
import { IconObj } from '@jetstream/types';
import classNames from 'classnames';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PageHeaderTitleProps {
  icon: IconObj;
  label: string;
  metaLabel?: string;
}

export const PageHeaderTitle: FunctionComponent<PageHeaderTitleProps> = ({ icon, label, metaLabel, children }) => {
  return (
    <div className="slds-page-header__col-title">
      <div className="slds-media">
        <div className="slds-media__figure">
          <Icon
            type={icon.type}
            icon={icon.icon}
            description={icon.description}
            className={`slds-icon slds-page-header__icon slds-icon-${icon.type}-${icon.icon}`}
          />
        </div>
        <div className="slds-media__body">
          <div className={classNames('slds-page-header__name', { 'slds-m-top_xx-small': !metaLabel })}>
            <div className="slds-page-header__name-title">
              <h1>
                <span className="slds-page-header__title slds-truncate" title={label}>
                  {label}
                </span>
              </h1>
            </div>
          </div>
          {/* In the future we could add a dropdown picker here */}
          {metaLabel && <p className="slds-page-header__name-meta">{metaLabel}</p>}
        </div>
      </div>
    </div>
  );
};

export default PageHeaderTitle;
