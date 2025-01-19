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
}

export const FileOrGoogleSelector = ({
  fileSelectorProps,
  googleSelectorProps,
  omitGoogle,
  googleShowUpgradeToPro,
  initialSelectedTab = 'local',
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
            content: <GoogleSelectedProUpgradeButton />,
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
