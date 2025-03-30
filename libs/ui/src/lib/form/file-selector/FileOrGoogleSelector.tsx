import { lazy } from 'react';
import Tabs from '../../tabs/Tabs';
import FileSelector, { FileSelectorProps } from './FileSelector';
import type { GoogleFileSelectorProps } from './GoogleFileSelector';
import { GoogleSelectedProUpgradeButton } from './GoogleSelectedProUpgradeButton';

const GoogleFileSelector = lazy(() => import('./GoogleFileSelector'));

export interface FileOrGoogleSelectorProps {
  fileSelectorProps: FileSelectorProps;
  googleSelectorProps: GoogleFileSelectorProps;
  omitGoogle?: boolean;
  googleShowUpgradeToPro: boolean;
  initialSelectedTab?: 'local' | 'google';
  source: string;
  trackEvent: (key: string, value?: Record<string, any>) => void;
}

export const FileOrGoogleSelector = ({
  fileSelectorProps,
  googleSelectorProps,
  omitGoogle,
  googleShowUpgradeToPro,
  initialSelectedTab = 'local',
  source,
  trackEvent,
}: FileOrGoogleSelectorProps) => {
  if (omitGoogle && !googleShowUpgradeToPro) {
    return <FileSelector {...fileSelectorProps}></FileSelector>;
  }

  if (googleShowUpgradeToPro) {
    return (
      <Tabs
        initialActiveId={initialSelectedTab}
        tabs={[
          {
            id: 'local',
            title: 'File from computer',
            content: <FileSelector {...fileSelectorProps}></FileSelector>,
          },
          {
            id: 'google',
            title: 'Google Drive',
            content: <GoogleSelectedProUpgradeButton trackEvent={trackEvent} source={source} />,
          },
        ]}
      />
    );
  }

  return (
    <Tabs
      initialActiveId={initialSelectedTab}
      tabs={[
        {
          id: 'local',
          title: 'File from computer',
          content: <FileSelector {...fileSelectorProps}></FileSelector>,
        },
        {
          id: 'google',
          title: 'Google Drive',
          content: <GoogleFileSelector {...googleSelectorProps} />,
        },
      ]}
    />
  );
};

export default FileOrGoogleSelector;
