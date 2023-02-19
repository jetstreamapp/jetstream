import { css } from '@emotion/react';
import { Children, Fragment, FunctionComponent } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PageHeaderActionsProps {
  // Use actions for title role, and controls for second row
  colType: 'actions' | 'controls';
  buttonType: 'separate' | 'list-group';
  children?: React.ReactNode;
}

export const PageHeaderActions: FunctionComponent<PageHeaderActionsProps> = ({ colType, buttonType, children }) => {
  return (
    <div
      className={`slds-page-header__col-${colType}`}
      css={css`
        ${colType === 'actions' ? 'margin-left: auto;' : ''}
      `}
    >
      <div className="slds-page-header__controls">
        {children &&
          buttonType === 'separate' &&
          // eslint-disable-next-line react/jsx-no-useless-fragment
          Children.map(children, (child) => <Fragment>{child && <div className="slds-page-header__control">{child}</div>}</Fragment>)}

        {children && buttonType === 'list-group' && (
          <div className="slds-page-header__control">
            <ul className="slds-button-group-list">
              {Children.map(children, (child) => (
                <li>{child}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeaderActions;
