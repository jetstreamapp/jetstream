import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { Link, useLocation } from 'react-router-dom';

export interface NavbarItemProps {
  className?: string;
  path: string;
  search?: string;
  label: string | JSX.Element;
  title: string;
}

export const NavbarItem: FunctionComponent<NavbarItemProps> = ({ className, path, search, label, title }) => {
  const location = useLocation();
  return (
    <li
      className={classNames('slds-context-bar__item', className, {
        'slds-is-active': location.pathname === path || location.pathname.startsWith(`${path}/`),
      })}
    >
      <Link tabIndex={-1} role="menuitem" className="slds-context-bar__label-action" title={title} to={{ pathname: path, search }}>
        <span className="slds-truncate" title={title}>
          {label}
        </span>
      </Link>
    </li>
  );
};

export default NavbarItem;
