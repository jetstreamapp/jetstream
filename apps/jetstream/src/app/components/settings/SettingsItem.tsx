import { css } from '@emotion/react';
import { FunctionComponent } from 'react';

export interface SettingsItemProps {
  className?: string;
  children: React.ReactNode;
}

export const SettingsItem: FunctionComponent<SettingsItemProps> = ({ className, children }) => {
  return (
    <div
      className={className}
      css={css`
        box-sizing: border-box;
        border-top: 1px solid rgba(0, 0, 0, 0.07);
        padding-top: 1rem;
        padding-bottom: 1rem;
      `}
    >
      {children}
    </div>
  );
};

export default SettingsItem;
