import { useCallback, useState } from 'react';
import {
  buildMultiObjectRequestExport,
  buildMultiObjectResultRows,
  MULTI_OBJECT_RESULTS_HEADER,
} from './load-records-multi-object-results';
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
      data: buildMultiObjectRequestExport(data),
      header: [],
      fileNameParts: ['load-to-multiple-objects', 'request'],
      allowedTypes: ['json'],
    });
  }, []);

  const downloadResults = useCallback((data: LoadMultiObjectRequestWithResult[], which: 'results' | 'failures') => {
    setDownloadModalData({
      open: true,
      data: buildMultiObjectResultRows(data, which),
      header: MULTI_OBJECT_RESULTS_HEADER,
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
