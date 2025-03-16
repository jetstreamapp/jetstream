import { css } from '@emotion/react';
import classNames from 'classnames';
import { FunctionComponent } from 'react';
import ProgressRing, { ProgressRingProps } from './ProgressRing';

export interface ProgressRingLoadingProps extends ProgressRingProps {
  // If provided, this overrides all other classes on the spinner div
  // Normally this is used with hasContainer={false}
  statusClassName?: string;
  containerClassName?: string;
}

export const ProgressRingLoading: FunctionComponent<ProgressRingLoadingProps> = ({
  statusClassName,
  containerClassName,
  ...progressRingProps
}) => {
  return (
    <div className={classNames('slds-spinner_container', containerClassName)}>
      <div
        role="status"
        className={statusClassName}
        css={css`
          position: absolute;
          top: 50%;
          left: 50%;
          z-index: 9051;
        `}
      >
        <ProgressRing {...progressRingProps} />
      </div>
    </div>
  );
};
