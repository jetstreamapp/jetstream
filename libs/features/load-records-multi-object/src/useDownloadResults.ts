import { useCallback, useState } from 'react';
import { LoadMultiObjectRequestWithResult } from './load-records-multi-object-types';

export const useDownloadResults = () => {
  const [downloadModalData, setDownloadModalData] = useState({
    open: false,
    data: [] as any[],
    header: [] as string[],
    fileNameParts: [] as string[],
    allowedTypes: ['xlsx', 'csv', 'json'],
  });

  const downloadRequests = useCallback((data: LoadMultiObjectRequestWithResult[]) => {
    setDownloadModalData({
      open: true,
      data: data.map((item) => ({ groupId: item.key, data: Object.values(item.dataWithResultsByGraphId) })),
      header: [],
      fileNameParts: ['load-to-multiple-objects', 'request'],
      allowedTypes: ['json'],
    });
  }, []);

  const downloadResults = useCallback((data: LoadMultiObjectRequestWithResult[], which: 'results' | 'failures') => {
    const outputData =
      data.flatMap(
        ({ results, recordWithResponseByRefId }) =>
          results
            ?.filter(({ isSuccessful }) => (which === 'failures' ? !isSuccessful : true))
            .flatMap(({ graphResponse, graphId }) =>
              graphResponse.compositeResponse.map((response) => {
                const { referenceId } = response;
                const { operation, sobject, externalId } = recordWithResponseByRefId[referenceId] || {};
                // PATCH returns 204 with no body
                if (!response.body) {
                  response.body = {
                    id: '',
                    success: true,
                    errors: [],
                  };
                }
                const { id, success, message, created, errorCode } = response.body;
                return {
                  Group: graphId,
                  Object: sobject,
                  Operation: operation,
                  'External Id': externalId,
                  'Reference Id': referenceId,
                  Id: id || '',
                  Success: !!success,
                  Created: !!created || (operation === 'INSERT' && !!success),
                  Error: errorCode ? `${errorCode}: ${message}` : '',
                };
              })
            ) || []
      ) || [];

    setDownloadModalData({
      open: true,
      data: outputData,
      header: ['Group', 'Object', 'Operation', 'External Id', 'Reference Id', 'Id', 'Success', 'Created', 'Error'],
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
