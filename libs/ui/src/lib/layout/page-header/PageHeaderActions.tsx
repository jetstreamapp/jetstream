import { Children, Fragment, FunctionComponent } from 'react';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface PageHeaderActionsProps {
  // Use actions for title role, and controls for second row
  colType: 'actions' | 'controls';
  buttonType: 'separate' | 'list-group';
}

export const PageHeaderActions: FunctionComponent<PageHeaderActionsProps> = ({ colType, buttonType, children }) => {
  return (
    <Fragment>
      <div className={`slds-page-header__col-${colType}`}>
        <div className="slds-page-header__controls">
          {children &&
            buttonType === 'separate' &&
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
    </Fragment>
  );
};

export default PageHeaderActions;
