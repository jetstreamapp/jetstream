import { css } from '@emotion/react';
import { IconObj } from '@jetstream/icon-factory';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import Icon from '../../widgets/Icon';
import ViewDocsLink from '../ViewDocsLink';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PageHeaderTitleProps {
  icon: IconObj;
  labelHeading?: string;
  label: string;
  docsPath?: string;
  metaLabel?: string;
  titleDropDown?: JSX.Element;
  children?: React.ReactNode;
}

export const PageHeaderTitle: FunctionComponent<PageHeaderTitleProps> = ({
  icon,
  labelHeading,
  label,
  docsPath,
  metaLabel,
  titleDropDown,
  children,
}) => {
  return (
    <div
      className="slds-page-header__col-title"
      css={css`
        min-width: fit-content;
      `}
    >
      <div className="slds-media">
        <div className="slds-media__figure">
          <Icon
            type={icon.type}
            icon={icon.icon}
            description={icon.description}
            className={`slds-icon slds-page-header__icon slds-icon-${icon.type}-${icon.icon?.replaceAll('_', '-')}`}
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
              {docsPath && <ViewDocsLink path={docsPath} />}
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
