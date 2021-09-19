import { GoogleApiData, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import RadioButton from 'libs/ui/src/lib/form/radio/RadioButton';
import RadioGroup from 'libs/ui/src/lib/form/radio/RadioGroup';
import GridCol from 'libs/ui/src/lib/grid/GridCol';
import { FunctionComponent, useState } from 'react';
import GoogleFolderSelector from '../../form/file-selector/GoogleFolderSelector';
import GoogleSignIn from '../../google/GoogleSignIn';

export interface FileDownloadGoogleProps {
  google_apiKey: string;
  google_appId: string;
  google_clientId: string;
  disabled?: boolean;
  onFolderSelected: (folderId: string) => void;
  onGoogleApiData: (apiData: GoogleApiData) => void;
}

export const FileDownloadGoogle: FunctionComponent<FileDownloadGoogleProps> = ({
  google_apiKey,
  google_appId,
  google_clientId,
  disabled,
  onGoogleApiData,
  onFolderSelected,
}) => {
  const [googleFolder, setGoogleFolder] = useState<{ name: string; folderId: string }>();
  const [whichFolder, setWhichFolder] = useState<'root' | 'specified'>('root');

  useNonInitialEffect(() => {
    onFolderSelected(whichFolder === 'root' ? undefined : googleFolder?.folderId);
  }, [whichFolder, googleFolder]);

  function handleGoogleFolderSelected(data: google.picker.DocumentObject) {
    setGoogleFolder({ name: data.name, folderId: data.id });
  }

  return (
    <div className="slds-p-horizontal_medium slds-p-bottom_medium">
      <GoogleSignIn
        apiConfig={{ apiKey: google_apiKey, appId: google_appId, clientId: google_clientId }}
        onSignInChanged={(apiData, profile) => onGoogleApiData(apiData)}
      >
        <GridCol size={12}>
          <RadioGroup label="Which Google Drive folder would you like to save to?" isButtonGroup>
            <RadioButton
              name="which-google-folder"
              label="Do not store in a folder"
              value="root"
              checked={whichFolder === 'root'}
              onChange={(value) => setWhichFolder('root')}
              disabled={disabled}
            />
            <RadioButton
              name="which-google-folder"
              label="Choose a folder"
              value="specified"
              checked={whichFolder === 'specified'}
              onChange={(value) => setWhichFolder('specified')}
              disabled={disabled}
            />
          </RadioGroup>
        </GridCol>
        {whichFolder === 'specified' && (
          <GoogleFolderSelector
            apiConfig={{ apiKey: google_apiKey, appId: google_appId, clientId: google_clientId }}
            id={'load-google-drive-file'}
            label={'Google Drive'}
            folderName={googleFolder?.name}
            disabled={disabled}
            onSelected={handleGoogleFolderSelected}
          />
        )}
      </GoogleSignIn>
    </div>
  );
};

export default FileDownloadGoogle;
