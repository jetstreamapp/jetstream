import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { FunctionComponent, useState } from 'react';
import GoogleFolderSelector from '../../form/file-selector/GoogleFolderSelector';
import RadioButton from '../../form/radio/RadioButton';
import RadioGroup from '../../form/radio/RadioGroup';
import GoogleSignIn from '../../google/GoogleSignIn';
import GridCol from '../../grid/GridCol';

export interface FileDownloadGoogleProps {
  google_apiKey: string;
  google_appId: string;
  google_clientId: string;
  disabled?: boolean;
  onFolderSelected: (folderId?: string) => void;
  onSignInChanged?: (signedIn: boolean) => void;
  onSelectorVisible?: (isVisible: boolean) => void;
}

export const FileDownloadGoogle: FunctionComponent<FileDownloadGoogleProps> = ({
  google_apiKey,
  google_appId,
  google_clientId,
  disabled,
  onSignInChanged,
  onFolderSelected,
  onSelectorVisible,
}) => {
  const [googleFolder, setGoogleFolder] = useState<{ name: string; folderId: string }>();
  const [whichFolder, setWhichFolder] = useState<'root' | 'specified'>('root');
  const [apiConfig] = useState({ apiKey: google_apiKey, appId: google_appId, clientId: google_clientId });

  useNonInitialEffect(() => {
    onFolderSelected(whichFolder === 'root' ? undefined : googleFolder?.folderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whichFolder, googleFolder]);

  function handleGoogleFolderSelected(data: google.picker.DocumentObject) {
    setGoogleFolder({ name: data.name, folderId: data.id });
  }

  return (
    <div className="slds-p-horizontal_medium slds-p-bottom_medium">
      <GoogleSignIn apiConfig={apiConfig} onSignInChanged={onSignInChanged}>
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
            apiConfig={apiConfig}
            id={'load-google-drive-file'}
            label={'Google Drive'}
            folderName={googleFolder?.name}
            disabled={disabled}
            onSelected={handleGoogleFolderSelected}
            onSelectorVisible={onSelectorVisible}
          />
        )}
      </GoogleSignIn>
    </div>
  );
};

export default FileDownloadGoogle;
