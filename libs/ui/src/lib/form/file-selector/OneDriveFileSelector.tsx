import { IFilePickerOptions, IPicker, MSALAuthenticate, Picker, Popup } from '@jetstream/onedrive';
import { logger } from '@jetstream/shared/client-logger';
import { InputReadGoogleSheet, Maybe } from '@jetstream/types';
import classNames from 'classnames';
import { uniqueId } from 'lodash';
import { FunctionComponent, useCallback, useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';
import Spinner from '../../widgets/Spinner';
import { useFilename } from './useFilename';
import { Configuration, PublicClientApplication } from '@azure/msal-browser';

const options: IFilePickerOptions = {
  sdk: '8.0',
  entry: {
    oneDrive: {
      files: {},
    },
  },
  authentication: {},
  messaging: {
    origin: 'http://localhost:4200',
    channelId: '27',
  },
  selection: {
    mode: 'pick',
  },
  typesAndSources: {
    filters: ['.xlsx', '.xls', '.csv'],
    mode: 'files',
    pivots: {
      oneDrive: true,
      recent: true,
    },
  },
};

export interface OneDriveFileSelectorProps {
  apiConfig: {
    clientId: string;
    clientAuthority: string;
    baseUrl: string;
  };
  id?: string;
  className?: string;
  filename?: Maybe<string>;
  label?: string;
  buttonLabel?: string;
  helpText?: string;
  labelHelp?: string | null;
  hideLabel?: boolean;
  isRequired?: boolean;
  disabled?: boolean;
  onSelectorVisible?: (isVisible: boolean) => void;
  onSelected?: (data: google.picker.ResponseObject) => void;
  onReadFile: (fileContent: InputReadGoogleSheet) => void;
  onError?: (error: string) => void;
}

export const OneDriveFileSelector: FunctionComponent<OneDriveFileSelectorProps> = ({
  apiConfig,
  id = uniqueId('google-file-input'),
  className,
  filename,
  label,
  buttonLabel = 'Choose Spreadsheet',
  hideLabel,
  labelHelp,
  helpText,
  isRequired,
  disabled,
  onSelectorVisible,
  onSelected,
  onReadFile,
  onError,
}) => {
  const [labelId] = useState(() => `${id}-label`);
  // const { data, error: scriptLoadError, loading: googleApiLoading, isVisible, openPicker } = useDrivePicker(apiConfig);
  const [msalParams, setMsalParams] = useState<Configuration>({
    auth: {
      authority: apiConfig.clientAuthority,
      clientId: apiConfig.clientId,
      redirectUri: 'http://localhost:4200',
    },
  });
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<google.picker.DocumentObject>();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [{ managedFilename, filenameTruncated }, setManagedFilename] = useFilename(filename);

  useEffect(() => {
    if (errorMessage && onError) {
      onError(errorMessage);
    }
  }, [errorMessage, onError]);

  // useEffect(() => {
  //   onSelectorVisible && onSelectorVisible(isVisible);
  // }, [onSelectorVisible, isVisible]);

  const handleDownloadFile = useCallback(
    async (data: google.picker.ResponseObject) => {
      try {
        if (Array.isArray(data.docs) && data.docs.length > 0) {
          const selectedItem = data.docs[0];
          setLoading(true);
          let resultBody: string;
          if (selectedItem.type === google.picker.Type.DOCUMENT) {
            const results = await gapi.client.drive.files.export({
              fileId: selectedItem.id,
              // https://developers.google.com/drive/api/v3/ref-export-formats
              mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            });
            resultBody = results.body;
          } else {
            const results = await gapi.client.drive.files.get({
              fileId: selectedItem.id,
              alt: 'media',
            });
            resultBody = results.body;
          }
          try {
            const workbook = XLSX.read(resultBody, { cellText: false, cellDates: true, type: 'binary' });
            setSelectedFile(selectedItem);
            setManagedFilename(selectedItem.name);
            onReadFile({ workbook, selectedFile: selectedItem });
          } catch (ex) {
            logger.error('Error processing file', ex);
            const errorMessage = ex?.result?.error?.message || ex.message || '';
            onError && onError(`Error parsing file. ${errorMessage}`);
            setErrorMessage(`Error loading selected file. ${errorMessage}`);
          }
        }
      } catch (ex) {
        logger.error('Error exporting file', ex);
        const errorMessage = ex?.result?.error?.message || ex.message || '';
        onError && onError(`Error loading selected file. ${errorMessage}`);
        setErrorMessage(`Error loading selected file. ${errorMessage}`);
        setManagedFilename(null);
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // useEffect(() => {
  //   if (data) {
  //     onSelected && onSelected(data);
  //     handleDownloadFile(data);
  //   }
  // }, [data, handleDownloadFile, onSelected]);

  const handleOpenPicker = useCallback(async () => {
    let _window: Window | null = null;
    try {
      // setup the picker with the desired behaviors
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      _window = window.open('', 'Picker', 'width=800,height=600')!;

      const picker = Picker(_window).using(Popup(), MSALAuthenticate(msalParams, ['OneDrive.ReadWrite']));
      // optionally log notifications to the console
      picker.on.notification((message) => {
        console.log('notification: ' + JSON.stringify(message));
      });

      // optionially log any logging from the library itself to the console
      picker.on.log((message, level) => {
        console.log(`log: [${level}] ${message}`);
      });

      picker.on.error((message) => {
        console.log(`ERROR: ${message}`);
      });

      // required returning something
      // picker.on.authenticate((command, result) => {
      //   console.log(`authenticate`, {command, result});
      // })
      picker.on.close(() => {
        console.log('close');
      });
      picker.on.dispose(() => {
        console.log('dispose');
      });
      picker.on.init(() => {
        console.log('init');
      });
      picker.on.pick((data) => {
        console.log('pick', { data });
      });

      // activate the picker with our baseUrl and options object
      const results = await picker.activate({
        baseUrl: apiConfig.baseUrl,
        pickerPathOverride: '',
        options,
      });
      console.log({ results });
    } catch (ex) {
      console.warn('ERROR!', ex);
      _window?.close();
    }
  }, [msalParams]);

  return (
    <div className={classNames('slds-form-element', { 'slds-has-error': !!errorMessage }, className)}>
      <span className={classNames('slds-form-element__label', { 'slds-assistive-text': hideLabel || !label })} id={labelId}>
        {isRequired && (
          <abbr className="slds-required" title="required">
            *{' '}
          </abbr>
        )}
        {label}
      </span>
      {labelHelp && label && !hideLabel && <HelpText id={`${id}-label-help-text`} content={labelHelp} />}
      <div className="slds-form-element__control">
        <label className="slds-file-selector__body" htmlFor={id}>
          {/* <button
            className="slds-is-relative slds-button slds-button_neutral"
            onClick={handleOpenPicker}
            disabled={googleApiLoading || disabled}
            aria-labelledby={`${labelId}`}
          >
            <Icon type="doctype" icon="gdrive" className="slds-button__icon slds-button__icon_left" omitContainer />
            {buttonLabel}
            {(loading || googleApiLoading) && !errorMessage && <Spinner size="small" />}
          </button> */}
          <button
            className="slds-is-relative slds-button slds-button_neutral"
            onClick={handleOpenPicker}
            // disabled={googleApiLoading || disabled}
            aria-labelledby={`${labelId}`}
          >
            <Icon type="doctype" icon="gdrive" className="slds-button__icon slds-button__icon_left" omitContainer />
            {buttonLabel} from OneDrive
            {loading && !errorMessage && <Spinner size="small" />}
          </button>
          <button
            className="slds-is-relative slds-button slds-button_neutral"
            onClick={handleOpenPicker}
            // disabled={googleApiLoading || disabled}
            aria-labelledby={`${labelId}`}
          >
            <Icon type="doctype" icon="gdrive" className="slds-button__icon slds-button__icon_left" omitContainer />
            {buttonLabel} from Sharepoint
            {loading && !errorMessage && <Spinner size="small" />}
          </button>
        </label>
      </div>
      {helpText && !selectedFile?.name && (
        <div className="slds-form-element__help slds-truncate" id="file-input-help" title={helpText}>
          {helpText}
        </div>
      )}
      {managedFilename && (
        <div className="slds-form-element__help slds-truncate" id="file-input-help" title={managedFilename}>
          {filenameTruncated}
        </div>
      )}
      {errorMessage && (
        <div className="slds-form-element__help slds-truncate" id="file-input-error">
          {errorMessage}
        </div>
      )}
    </div>
  );
};

export default OneDriveFileSelector;
