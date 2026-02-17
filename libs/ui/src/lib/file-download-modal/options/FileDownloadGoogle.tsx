import { logger } from '@jetstream/shared/client-logger';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { GoogleUserInfo, Maybe } from '@jetstream/types';
import { FunctionComponent, useCallback, useEffectEvent, useState } from 'react';
import z from 'zod';
import GoogleFolderSelector from '../../form/file-selector/GoogleFolderSelector';
import RadioButton from '../../form/radio/RadioButton';
import RadioGroup from '../../form/radio/RadioGroup';
import GoogleSignIn from '../../google/GoogleSignIn';
import GridCol from '../../grid/GridCol';

const WhichFolderSchema = z.enum(['root', 'specified']);
type WhichFolder = z.infer<typeof WhichFolderSchema>;

const FolderSelectionSchema = z.object({ name: z.string(), folderId: z.string() });
type FolderSelection = z.infer<typeof FolderSelectionSchema>;

const LS_FOLDER_SELECTION_KEY = 'RECENT_GOOGLE_FOLDER_SELECTION';
const LS_FOLDER_INFO_KEY = 'RECENT_GOOGLE_FOLDER';

function getWhichFolderFromStorage(userInfo: Maybe<GoogleUserInfo>): WhichFolder {
  if (!userInfo) {
    return WhichFolderSchema.enum.root;
  }
  try {
    const key = `${LS_FOLDER_SELECTION_KEY}:${userInfo.id}`;
    const value = localStorage.getItem(key);
    if (value) {
      return WhichFolderSchema.parse(value);
    }
    return WhichFolderSchema.enum.root;
  } catch {
    logger.warn('Failed to get which folder selection from localStorage');
    return WhichFolderSchema.enum.root;
  }
}

function getFolderSelectionFromStorage(userInfo: Maybe<GoogleUserInfo>): Maybe<FolderSelection> {
  if (!userInfo) {
    return null;
  }
  try {
    const key = `${LS_FOLDER_INFO_KEY}:${userInfo.id}`;
    const value = localStorage.getItem(key);
    if (value) {
      return FolderSelectionSchema.parse(JSON.parse(value));
    }
  } catch {
    logger.warn('Failed to get folder selection from localStorage');
    return null;
  }
  return null;
}

function saveWhichFolderToStorage(userInfo: GoogleUserInfo, whichFolder: WhichFolder) {
  if (!userInfo) {
    return;
  }
  try {
    const key = `${LS_FOLDER_SELECTION_KEY}:${userInfo.id}`;
    localStorage.setItem(key, whichFolder);
  } catch (ex) {
    logger.warn('Failed to save which folder selection to localStorage', { error: ex });
  }
}

function saveFolderSelectionToStorage(userInfo: GoogleUserInfo, folder: Maybe<FolderSelection>) {
  if (!userInfo) {
    return;
  }
  try {
    const key = `${LS_FOLDER_INFO_KEY}:${userInfo.id}`;
    if (!folder) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(folder));
    }
  } catch (ex) {
    logger.warn('Failed to save folder selection to localStorage', { error: ex });
  }
}

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
  const [userInfo, setUserInfo] = useState<Maybe<GoogleUserInfo>>(null);
  const [googleFolder, setGoogleFolder] = useState<Maybe<FolderSelection>>(null);
  const [whichFolder, setWhichFolder] = useState<'root' | 'specified'>('root');
  const [apiConfig] = useState({ apiKey: google_apiKey, appId: google_appId, clientId: google_clientId });

  const onFolderSelectedEvent = useEffectEvent(onFolderSelected);

  useNonInitialEffect(() => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    onFolderSelectedEvent(whichFolder === 'root' ? undefined : googleFolder?.folderId);
  }, [whichFolder, googleFolder]);

  const handleUserInfoChange = useCallback((user: Maybe<GoogleUserInfo>) => {
    setUserInfo(user);
    if (user) {
      setWhichFolder(getWhichFolderFromStorage(user));
      setGoogleFolder(getFolderSelectionFromStorage(user));
    }
  }, []);

  function handleGoogleFolderSelected(data: google.picker.DocumentObject) {
    if (!data.name || !data.id) {
      return;
    }
    const folderData = { name: data.name, folderId: data.id };
    setGoogleFolder(folderData);
    if (userInfo) {
      saveFolderSelectionToStorage(userInfo, folderData);
    }
  }

  return (
    <div className="slds-p-horizontal_medium slds-p-bottom_medium">
      <GoogleSignIn apiConfig={apiConfig} onSignInChanged={onSignInChanged} onUserInfoChange={handleUserInfoChange}>
        <GridCol size={12}>
          <RadioGroup label="Which Google Drive folder would you like to save to?" isButtonGroup>
            <RadioButton
              name="which-google-folder"
              label="Do not store in a folder"
              value="root"
              checked={whichFolder === 'root'}
              onChange={(value) => {
                setWhichFolder('root');
                if (userInfo) {
                  saveWhichFolderToStorage(userInfo, 'root');
                }
              }}
              disabled={disabled}
            />
            <RadioButton
              name="which-google-folder"
              label="Choose a folder"
              value="specified"
              checked={whichFolder === 'specified'}
              onChange={(value) => {
                setWhichFolder('specified');
                if (userInfo) {
                  saveWhichFolderToStorage(userInfo, 'specified');
                  if (googleFolder) {
                    saveFolderSelectionToStorage(userInfo, googleFolder);
                  }
                }
              }}
              disabled={disabled}
            />
          </RadioGroup>
        </GridCol>
        {whichFolder === 'specified' && (
          <GoogleFolderSelector
            apiConfig={apiConfig}
            id={'load-google-drive-file'}
            label="Google Drive"
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
