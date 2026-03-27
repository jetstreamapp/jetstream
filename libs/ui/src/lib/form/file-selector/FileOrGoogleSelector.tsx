import Tabs from '../../tabs/Tabs';
import FileSelector, { FileSelectorProps } from './FileSelector';
import { GoogleFileSelector, type GoogleFileSelectorProps } from './GoogleFileSelector';
import { GoogleFileSelectorExternalButton } from './GoogleFileSelectorExternalButton';
import { GoogleSelectedProUpgradeButton } from './GoogleSelectedProUpgradeButton';

export interface FileOrGoogleSelectorProps {
  fileSelectorProps: FileSelectorProps;
  googleSelectorProps: GoogleFileSelectorProps;
  omitGoogle?: boolean;
  /**
   * If true, the user can access google using an external login flow (e.g. desktop / web extension)
   */
  hasExternalGoogleDriveAccess?: boolean;
  googleShowUpgradeToPro: boolean;
  initialSelectedTab?: 'local' | 'google';
  source: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trackEvent: (key: string, value?: Record<string, any>) => void;
}

export const FileOrGoogleSelector = ({
  fileSelectorProps,
  googleSelectorProps,
  omitGoogle,
  hasExternalGoogleDriveAccess,
  googleShowUpgradeToPro,
  initialSelectedTab = 'local',
  source,
  trackEvent,
}: FileOrGoogleSelectorProps) => {
  if (hasExternalGoogleDriveAccess) {
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
            content: <GoogleFileSelectorExternalButton {...googleSelectorProps} />,
          },
        ]}
      />
    );
  }

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
