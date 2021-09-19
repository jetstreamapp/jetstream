import { IconObj } from '@jetstream/icon-factory';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import Icon from '../../widgets/Icon';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PageHeaderTitleProps {
  icon: IconObj;
  labelHeading?: string;
  label: string;
  metaLabel?: string;
  titleDropDown?: JSX.Element;
}

export const PageHeaderTitle: FunctionComponent<PageHeaderTitleProps> = ({
  icon,
  labelHeading,
  label,
  metaLabel,
  titleDropDown,
  children,
}) => {
  return (
    <div className="slds-page-header__col-title">
      <div className="slds-media">
        <div className="slds-media__figure">
          <Icon
            type={icon.type}
            icon={icon.icon}
            description={icon.description}
            className={`slds-icon slds-page-header__icon slds-icon-${icon.type}-${icon.icon?.replace('_', '-')}`}
          />
        </div>
        <div className="slds-media__body">
          <div className={classNames('slds-page-header__name', { 'slds-m-top_xx-small': !metaLabel })}>
            <div className="slds-page-header__name-title">
              <h1>
                {labelHeading && <span>{labelHeading}</span>}
                <span className="slds-page-header__title slds-truncate" title={label}>
                  {label}
                </span>
              </h1>
            </div>
            {titleDropDown && <div className="slds-page-header__name-switcher">{titleDropDown}</div>}
          </div>
          {/* In the future we could add a dropdown picker here */}
          {metaLabel && <p className="slds-page-header__name-meta">{metaLabel}</p>}
        </div>
      </div>
    </div>
  );
};

export default PageHeaderTitle;
