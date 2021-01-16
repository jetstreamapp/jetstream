import { Icon, PopoverErrorButton, Tooltip } from '@jetstream/ui';
import classNames from 'classnames';
import React, { ButtonHTMLAttributes, Fragment, FunctionComponent } from 'react';
import { QueryRestoreErrors } from '../utils/query-restore-utils';
import useQueryRestore from '../utils/useQueryRestore';

interface RestoreQueryProps {
  soql: string;
  isTooling: boolean;
  label?: string;
  className?: string;
  tooltip?: string;
  buttonProps?: ButtonHTMLAttributes<HTMLButtonElement>;
  startRestore?: () => void;
  endRestore?: (isTooling: boolean, fatalError: boolean, errors?: QueryRestoreErrors) => void;
}

export const RestoreQuery: FunctionComponent<RestoreQueryProps> = ({
  soql,
  isTooling,
  label = 'Restore',
  className,
  tooltip = 'Show this query on the query builder page',
  buttonProps,
  startRestore,
  endRestore,
}) => {
  const [restore, errorMessage] = useQueryRestore(soql, isTooling, { startRestore, endRestore });

  return (
    <Fragment>
      {errorMessage && <PopoverErrorButton errors={[errorMessage]} />}
      <Tooltip content={tooltip}>
        <button className={classNames('slds-button', className)} onClick={() => restore(undefined, isTooling)} {...buttonProps}>
          <Icon type="utility" icon="task" className="slds-button__icon slds-button__icon_left" />
          {label}
        </button>
      </Tooltip>
    </Fragment>
  );
};

export default RestoreQuery;
