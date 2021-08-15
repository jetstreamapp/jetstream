import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';

export function useFilename(filename: string): [{ managedFilename: string; filenameTruncated: string }, Dispatch<SetStateAction<string>>] {
  const [managedFilename, setManagedFilename] = useState<string>(filename);
  const [filenameTruncated, setFilenameTruncated] = useState<string>(null);

  useEffect(() => {
    if (!filename) {
      setFilenameTruncated(null);
    } else {
      if (filename.length > 40) {
        setFilenameTruncated(`${filename.substring(0, 25)}...${filename.substring(filename.length - 10)}`);
      } else {
        setFilenameTruncated(filename);
      }
    }
  }, [filename]);

  useNonInitialEffect(() => {
    setManagedFilename(filename);
  }, [filename]);

  return [{ managedFilename, filenameTruncated }, setManagedFilename];
}
