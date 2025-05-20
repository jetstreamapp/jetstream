import { DesktopAction } from '@jetstream/desktop/types';
import { logger } from '@jetstream/shared/client-logger';
import { parseFile } from '@jetstream/shared/ui-utils';
import { fireToast, XlsxSheetSelectionModalPromise } from '@jetstream/ui';
import { fromLoadRecordsState } from '@jetstream/ui-core';
import { useCallback, useEffect } from 'react';
import { useSetRecoilState } from 'recoil';

const onParsedMultipleWorkbooks = async (worksheets: string[]): Promise<string> => {
  return await XlsxSheetSelectionModalPromise({ worksheets });
};

export const useElectronActionLoader = () => {
  const setInputFileData = useSetRecoilState(fromLoadRecordsState.inputFileDataState);
  const setInputFileHeader = useSetRecoilState(fromLoadRecordsState.inputFileHeaderState);
  const setInputFilename = useSetRecoilState(fromLoadRecordsState.inputFilenameState);
  const setInputFilenameType = useSetRecoilState(fromLoadRecordsState.inputFilenameTypeState);

  const handleElectronAction = useCallback(
    async ({ action, payload }: DesktopAction) => {
      try {
        switch (action) {
          case 'LOAD_RECORD': {
            const { fileContent } = payload;
            const { content, extension, filename, isPasteFromClipboard } = fileContent;
            if (fileContent) {
              const { data, headers, errors } = await parseFile(content, { onParsedMultipleWorkbooks, isPasteFromClipboard, extension });
              setInputFileData(data);
              setInputFileHeader(headers);
              setInputFilename(filename);
              setInputFilenameType('local');
              if (errors.length > 0) {
                logger.warn(errors);
                // suppress delimiter error if it is the only error and just one column of data
                if (headers.length !== 1 || errors.length !== 1 || !errors[0].includes('auto-detect delimiting character')) {
                  fireToast({
                    message: `There were errors parsing the file. Check the file preview to ensure the data is correct. ${errors.join()}`,
                    type: 'warning',
                  });
                }
              }
            } else {
              logger.warn('No file content provided for LOAD_RECORD action');
            }
            break;
          }
          default: {
            logger.warn(`Unhandled action type: ${action}`);
            break;
          }
        }
      } catch (ex) {
        logger.error('Error handling electron action:', ex);
      }
    },
    [setInputFileData, setInputFileHeader, setInputFilename, setInputFilenameType]
  );

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI?.onAction(handleElectronAction);
    }
  }, [handleElectronAction]);

  return null;
};
