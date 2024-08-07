import { Fragment, FunctionComponent, lazy } from 'react';
import Tabs from '../../tabs/Tabs';
import FileSelector, { FileSelectorProps } from './FileSelector';
import type { GoogleFileSelectorProps } from './GoogleFileSelector';

const GoogleFileSelector = lazy(() => import('./GoogleFileSelector'));

export interface FileOrGoogleSelectorProps {
  fileSelectorProps: FileSelectorProps;
  googleSelectorProps: GoogleFileSelectorProps;
  omitGoogle?: boolean;
  initialSelectedTab?: 'local' | 'google';
}

export const FileOrGoogleSelector: FunctionComponent<FileOrGoogleSelectorProps> = ({
  fileSelectorProps,
  googleSelectorProps,
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
          ]}
        />
      )}
    </Fragment>
  );
};

export default FileOrGoogleSelector;
