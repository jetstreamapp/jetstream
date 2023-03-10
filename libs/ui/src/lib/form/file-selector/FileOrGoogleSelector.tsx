import Tabs from '../../tabs/Tabs';
import { Fragment, FunctionComponent } from 'react';
import FileSelector, { FileSelectorProps } from './FileSelector';
import GoogleFileSelector, { GoogleFileSelectorProps } from './GoogleFileSelector';
import OneDriveFileSelector, { OneDriveFileSelectorProps } from './OneDriveFileSelector';

export interface FileOrGoogleSelectorProps {
  fileSelectorProps: FileSelectorProps;
  googleSelectorProps: GoogleFileSelectorProps;
  oneDriveSelectorProps?: OneDriveFileSelectorProps;
  omitGoogle?: boolean;
  initialSelectedTab?: 'local' | 'google';
}

export const FileOrGoogleSelector: FunctionComponent<FileOrGoogleSelectorProps> = ({
  fileSelectorProps,
  googleSelectorProps,
  oneDriveSelectorProps,
  omitGoogle,
  initialSelectedTab = 'local',
}) => {
  return (
    // eslint-disable-next-line react/jsx-no-useless-fragment
    <Fragment>
      {omitGoogle ? (
        <FileSelector {...fileSelectorProps}></FileSelector>
      ) : (
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
            ...(oneDriveSelectorProps
              ? [
                  {
                    id: 'onedrive',
                    title: 'Microsoft OneDrive',
                    content: <OneDriveFileSelector {...oneDriveSelectorProps} />,
                  },
                ]
              : []),
          ]}
        />
      )}
    </Fragment>
  );
};

export default FileOrGoogleSelector;
