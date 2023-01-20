import { FunctionComponent, ReactNode } from 'react';
import Icon from './Icon';

export interface FeedbackLinkProps {
  type: 'GH_ISSUE' | 'GH_DISCUSSION' | 'DISCORD' | 'EMAIL';
  label?: ReactNode;
  omitInNewWindowIcon?: boolean;
  onClick?: () => void;
}

export const FeedbackLink: FunctionComponent<FeedbackLinkProps> = ({ type, label: _label, omitInNewWindowIcon, onClick }) => {
  let link = '';
  let label: ReactNode;

  switch (type) {
    case 'GH_ISSUE':
      link = 'https://github.com/jetstreamapp/jetstream/issues';
      label = _label || 'Create a Github Issue';
      break;
    case 'GH_DISCUSSION':
      link = 'https://github.com/jetstreamapp/jetstream/discussions';
      label = _label || 'Start a Github Discussion';
      break;
    case 'DISCORD':
      link = 'https://discord.gg/sfxd';
      label = _label || 'SFXD Discord Community';
      break;
    case 'EMAIL':
      link = 'mailto:support@getjetstream.app';
      label = _label || 'support@getjetstream.app';
      break;
    default:
      return null;
  }

  return (
    <>
      <a href={link} target="_blank" rel="noreferrer" onClick={onClick}>
        {label}
      </a>
      {!omitInNewWindowIcon && (
        <Icon
          type="utility"
          icon="new_window"
          className="slds-icon slds-icon_x-small slds-icon-text-default slds-m-left_xx-small"
          omitContainer
        />
      )}
    </>
  );
};

export default FeedbackLink;
