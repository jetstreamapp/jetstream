import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { Link, useLocation } from 'react-router-dom';

export interface NavbarItemWaffleProps {
  path: string;
  search?: string;
  title?: string;
  assistiveText?: string;
}

/**
 * Home/app-launcher style navbar item rendered as the Salesforce "waffle" icon.
 *
 * The waffle (`slds-icon-waffle_container`) must be the focusable element itself so that its `:focus`
 * color animation fires and its `outline: 0` suppresses the default focus ring - so this is a dedicated
 * item rather than wrapping the waffle inside the generic `NavbarItem` label action.
 */
export const NavbarItemWaffle: FunctionComponent<NavbarItemWaffleProps> = ({
  path,
  search,
  title = 'Home',
  assistiveText = 'Home Page',
}) => {
  const location = useLocation();
  const isActive = location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <li className={classNames('slds-context-bar__item', { 'slds-is-active': isActive })}>
      <div className="slds-context-bar__icon-action">
        <Link to={{ pathname: path, search }} className="slds-button slds-icon-waffle_container slds-context-bar__button" title={title}>
          <span className="slds-icon-waffle">
            <span className="slds-r1"></span>
            <span className="slds-r2"></span>
            <span className="slds-r3"></span>
            <span className="slds-r4"></span>
            <span className="slds-r5"></span>
            <span className="slds-r6"></span>
            <span className="slds-r7"></span>
            <span className="slds-r8"></span>
            <span className="slds-r9"></span>
          </span>
          <span className="slds-assistive-text">{assistiveText}</span>
        </Link>
      </div>
    </li>
  );
};

export default NavbarItemWaffle;
