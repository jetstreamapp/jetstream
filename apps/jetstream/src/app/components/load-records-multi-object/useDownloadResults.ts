import { useCallback, useState } from 'react';
import { LoadMultiObjectRequestWithResult } from './load-records-multi-object-types';

export const useDownloadResults = () => {
  const [downloadModalData, setDownloadModalData] = useState({
    open: false,
    data: [],
    header: [],
    fileNameParts: [],
    allowedTypes: ['xlsx', 'csv', 'json'],
  });

  const downloadRequests = useCallback((data: LoadMultiObjectRequestWithResult[]) => {
    setDownloadModalData({
      open: true,
      data: data.flatMap((item) => item.data),
      header: [],
      fileNameParts: ['load-to-multiple-objects', 'request'],
      allowedTypes: ['json'],
    });
  }, []);

  const downloadResults = useCallback((data: LoadMultiObjectRequestWithResult[], which: 'results' | 'failures') => {
    const outputData = data.flatMap(({ results, recordWithResponseByRefId }) =>
      results
        .filter(({ isSuccessful }) => (which === 'failures' ? !isSuccessful : true))
        .flatMap(({ graphResponse, graphId }) =>
          graphResponse.compositeResponse.map((response) => {
            const { referenceId } = response;
            const { operation, sobject, externalId } = recordWithResponseByRefId[referenceId];
            const { id, success, message, errorCode } = response.body as {
              id?: string;
              success?: boolean;
              message?: string;
              errorCode?: string;
              fields?: string[];
              errors?: unknown[];
            };
            return {
              Group: graphId,
              Object: sobject,
              Operation: operation,
              'External Id': externalId,
              'Reference Id': referenceId,
              Id: id || '',
              Success: !!success,
              Error: errorCode ? `${errorCode}: ${message}` : '',
            };
          })
        )
    );

    setDownloadModalData({
      open: true,
      data: outputData,
      header: ['Group', 'Object', 'Operation', 'External Id', 'Reference Id', 'Id', 'Success', 'Error'],
      fileNameParts: ['load-to-multiple-objects', which],
      allowedTypes: ['xlsx', 'csv', 'json'],
    });
  }, []);

  function handleCloseDownloadModal() {
    setDownloadModalData({ open: false, data: [], header: [], fileNameParts: [], allowedTypes: ['xlsx', 'csv', 'json'] });
  }

  return { downloadRequests, downloadResults, handleCloseDownloadModal, downloadModalData };
};

export default useDownloadResults;
