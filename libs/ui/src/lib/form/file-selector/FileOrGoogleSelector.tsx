/** @jsx jsx */
import { jsx } from '@emotion/react';
import Tabs from '../../tabs/Tabs';
import { Fragment, FunctionComponent } from 'react';
import GoogleSignIn from '../../google/GoogleSignIn';
import FileSelector, { FileSelectorProps } from './FileSelector';
import GoogleFileSelector, { GoogleFileSelectorProps } from './GoogleFileSelector';

export interface FileOrGoogleSelectorProps {
  fileSelectorProps: FileSelectorProps;
  googleSelectorProps: GoogleFileSelectorProps;
  omitGoogle?: boolean;
}

export const FileOrGoogleSelector: FunctionComponent<FileOrGoogleSelectorProps> = ({
  fileSelectorProps,
  googleSelectorProps,
  omitGoogle,
}) => {
  return (
    <Fragment>
      {omitGoogle ? (
        <FileSelector {...fileSelectorProps}></FileSelector>
      ) : (
        <Tabs
          initialActiveId="local"
          tabs={[
            {
              id: 'local',
              title: 'File from computer',
              content: <FileSelector {...fileSelectorProps}></FileSelector>,
            },
            {
              id: 'google',
              title: 'Google Drive',
              content: (
                <GoogleSignIn apiConfig={googleSelectorProps.apiConfig}>
                  <div>
                    <GoogleFileSelector {...googleSelectorProps} />
                  </div>
                </GoogleSignIn>
              ),
            },
          ]}
        />
      )}
    </Fragment>
  );
};

export default FileOrGoogleSelector;
