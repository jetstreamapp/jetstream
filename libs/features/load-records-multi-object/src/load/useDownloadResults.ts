import { useCallback, useState } from 'react';
import { LoadMultiObjectRequestWithResult } from '../load-records-multi-object-types';
import { RESULTS_DOWNLOAD_HEADER, RecordResultRow, buildResultsDownloadRows } from './load-results-utils';

export const useDownloadResults = () => {
  const [downloadModalData, setDownloadModalData] = useState({
    open: false,
    data: [] as any[],
    header: [] as string[],
    fileNameParts: [] as string[],
    allowedTypes: ['xlsx', 'csv', 'json'],
  });

  const downloadRequests = useCallback((requests: LoadMultiObjectRequestWithResult[]) => {
    setDownloadModalData({
      open: true,
      data: requests.map((request) => ({ groupId: request.key, data: Object.values(request.dataWithResultsByGraphId) })),
      header: [],
      fileNameParts: ['load-to-multiple-objects', 'request'],
      allowedTypes: ['json'],
    });
  }, []);

  const downloadResults = useCallback((rows: RecordResultRow[], which: 'results' | 'failures') => {
    setDownloadModalData({
      open: true,
      data: buildResultsDownloadRows(rows, which),
      header: RESULTS_DOWNLOAD_HEADER,
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
