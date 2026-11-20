import { css } from '@emotion/react';
import classNames from 'classnames';
import { FunctionComponent } from 'react';

export interface ProBadgeProps {
  className?: string;
  title?: string;
}

/** Small teal "Pro" pill marking a paid-only (Jetstream Pro) feature; matches the Jetstream Pro logo gradient. */
export const ProBadge: FunctionComponent<ProBadgeProps> = ({ className, title = 'Jetstream Pro feature' }) => (
  <span
    className={classNames('slds-badge', className)}
    css={css`
      /* teal-700 → cyan-800: white 12px text on the old teal-600 start was 3.7:1 */
      background-image: linear-gradient(to right, #0f766e, #155e75);
      color: #ffffff;
    `}
    title={title}
  >
    Pro
  </span>
);

export default ProBadge;
