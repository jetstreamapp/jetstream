import { logger } from '@jetstream/shared/client-logger';
import {
  GoogleApiClientConfig,
  isBrowserExtension,
  isDesktop,
  isExternalGoogleAccessTokenValid,
  useNonInitialEffect,
} from '@jetstream/shared/ui-utils';
import { GoogleUserInfo, Maybe } from '@jetstream/types';
import { FunctionComponent, useCallback, useEffect, useEffectEvent, useState } from 'react';
import z from 'zod';
import GoogleFolderSelector from '../../form/file-selector/GoogleFolderSelector';
import { GoogleFolderSelection, GoogleFolderSelectorExternalButton } from '../../form/file-selector/GoogleFolderSelectorExternalButton';
import RadioButton from '../../form/radio/RadioButton';
import RadioGroup from '../../form/radio/RadioGroup';
import GoogleSignIn from '../../google/GoogleSignIn';
import GoogleSignInExternal from '../../google/GoogleSignInExternal';
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
  google_apiKey?: string;
  google_appId?: string;
  google_clientId?: string;
  disabled?: boolean;
  onFolderSelected: (folderId?: string) => void;
  onSignInChanged?: (signedIn: boolean) => void;
  onSelectorVisible?: (isVisible: boolean) => void;
}

export const FileDownloadGoogle: FunctionComponent<FileDownloadGoogleProps> = (props) => {
  if (isDesktop() || isBrowserExtension()) {
    return <FileDownloadGoogleExternal {...props} />;
  }
  return <FileDownloadGoogleWeb {...props} />;
};

const FileDownloadGoogleExternal: FunctionComponent<FileDownloadGoogleProps> = ({ disabled, onSignInChanged, onFolderSelected }) => {
  const [userInfo, setUserInfo] = useState<Maybe<GoogleUserInfo>>(null);
  const [isAuthorized, setIsAuthorized] = useState(() => isExternalGoogleAccessTokenValid());
  // Folder state is initialized to defaults here; actual persisted values are restored
  // in handleUserInfoChange once userInfo becomes available asynchronously.
  const [googleFolder, setGoogleFolder] = useState<Maybe<FolderSelection>>(null);
  const [whichFolder, setWhichFolder] = useState<WhichFolder>('root');

  const onFolderSelectedEvent = useEffectEvent(onFolderSelected);

  // Signal sign-in state to parent
  useEffect(() => {
    onSignInChanged?.(isAuthorized);
  }, [isAuthorized, onSignInChanged]);

  const handleUserInfoChange = useCallback((user: Maybe<GoogleUserInfo>) => {
    setUserInfo(user);
    if (user) {
      const restoredWhichFolder = getWhichFolderFromStorage(user);
      const restoredGoogleFolder = getFolderSelectionFromStorage(user);
      setWhichFolder(restoredWhichFolder);
      setGoogleFolder(restoredGoogleFolder);
      // Notify parent of restored folder selection so the download target is correct on initial load
      onFolderSelectedEvent(restoredWhichFolder === 'root' ? undefined : restoredGoogleFolder?.folderId);
    }
  }, []);

  useNonInitialEffect(() => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    onFolderSelectedEvent(whichFolder === 'root' ? undefined : googleFolder?.folderId);
  }, [whichFolder, googleFolder]);

  function handleGoogleFolderSelected(data: GoogleFolderSelection) {
    const folderData = { name: data.name, folderId: data.id };
    setGoogleFolder(folderData);
    userInfo && saveFolderSelectionToStorage(userInfo, folderData);
    // Folder picker also refreshes the auth token
    setIsAuthorized(true);
  }

  const handleSignInChange = useCallback((authorized: boolean) => {
    setIsAuthorized(authorized);
  }, []);

  return (
    <div className="slds-p-horizontal_medium slds-p-bottom_medium">
      <GoogleSignInExternal onSignInChanged={handleSignInChange} onUserInfoChange={handleUserInfoChange}>
        <GridCol size={12}>
          <RadioGroup label="Which Google Drive folder would you like to save to?" isButtonGroup>
            <RadioButton
              name="which-google-folder"
              label="Do not store in a folder"
              value="root"
              checked={whichFolder === 'root'}
              onChange={() => {
                setWhichFolder('root');
                userInfo && saveWhichFolderToStorage(userInfo, 'root');
              }}
              disabled={disabled}
            />
            <RadioButton
              name="which-google-folder"
              label="Choose a folder"
              value="specified"
              checked={whichFolder === 'specified'}
              onChange={() => {
                setWhichFolder('specified');
                userInfo && saveWhichFolderToStorage(userInfo, 'specified');
              }}
              disabled={disabled}
            />
          </RadioGroup>
        </GridCol>
        {whichFolder === 'specified' && (
          <GoogleFolderSelectorExternalButton
            id={'load-google-drive-folder'}
            label="Google Drive"
            folderName={googleFolder?.name}
            disabled={disabled}
            onSelected={handleGoogleFolderSelected}
          />
        )}
      </GoogleSignInExternal>
    </div>
  );
};

const FileDownloadGoogleWeb: FunctionComponent<FileDownloadGoogleProps> = ({
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
  const [apiConfig] = useState({ apiKey: google_apiKey, appId: google_appId, clientId: google_clientId } as GoogleApiClientConfig);

  const onFolderSelectedEvent = useEffectEvent(onFolderSelected);

  useNonInitialEffect(() => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    onFolderSelectedEvent(whichFolder === 'root' ? undefined : googleFolder?.folderId);
  }, [whichFolder, googleFolder]);

  const handleUserInfoChange = useCallback((user: Maybe<GoogleUserInfo>) => {
    setUserInfo(user);
    if (user) {
      const restoredWhichFolder = getWhichFolderFromStorage(user);
      const restoredGoogleFolder = getFolderSelectionFromStorage(user);
      setWhichFolder(restoredWhichFolder);
      setGoogleFolder(restoredGoogleFolder);
      // Notify parent of restored folder selection so the download target is correct on initial load
      onFolderSelectedEvent(restoredWhichFolder === 'root' ? undefined : restoredGoogleFolder?.folderId);
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
