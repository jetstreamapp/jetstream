import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { Maybe } from '@jetstream/types';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';

export function useFilename(
  filename: Maybe<string>
): [{ managedFilename: string | null; filenameTruncated: string | null }, Dispatch<SetStateAction<string | null>>] {
  const [managedFilename, setManagedFilename] = useState<string | null>(filename || null);
  const [filenameTruncated, setFilenameTruncated] = useState<string | null>(null);

  useEffect(() => {
    const _filename = filename || managedFilename;
    if (!_filename) {
      setFilenameTruncated(null);
    } else {
      if (_filename.length > 40) {
        setFilenameTruncated(`${_filename.substring(0, 25)}...${_filename.substring(_filename.length - 10)}`);
      } else {
        setFilenameTruncated(_filename || '');
      }
    }
  }, [filename, managedFilename]);

  useNonInitialEffect(() => {
    setManagedFilename(filename || null);
  }, [filename]);

  return [{ managedFilename, filenameTruncated }, setManagedFilename];
}
