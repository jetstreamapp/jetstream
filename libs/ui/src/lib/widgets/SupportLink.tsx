import classNames from 'classnames';
import { FunctionComponent } from 'react';
import { Link } from 'react-router-dom';
import Grid, { GridProps } from '../grid/Grid';
import Icon from './Icon';

export interface SupportLinkProps extends GridProps {
  className?: string;
  label?: string | React.ReactNode;
  iconClass?: string;
}

export const SupportLink: FunctionComponent<SupportLinkProps> = (props) => {
  const {
    className = 'slds-current-color',
    label = 'An unexpected error has occurred, please try again. If you experiencing issues,',
    iconClass = 'slds-current-color',
    ...rest
  } = props;
  return (
    <Grid className={className} {...rest}>
      {label}
      <Link to={{ pathname: '/feedback' }} target="blank" className="slds-grid slds-m-left_xx-small">
        <span className="slds-truncate" title="Get Help">
          Get Help
        </span>
        <Icon
          type="utility"
          icon="new_window"
          className={classNames('slds-icon slds-icon_x-small slds-m-left_xx-small', iconClass)}
          omitContainer
        />
      </Link>
    </Grid>
  );
};

export default SupportLink;
