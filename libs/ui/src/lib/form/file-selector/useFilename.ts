import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { Maybe } from '@jetstream/types';
import { Dispatch, SetStateAction, useEffect, useState } from 'react';

export function useFilename(
  filename: Maybe<string>
): [{ managedFilename: string | null; filenameTruncated: string | null }, Dispatch<SetStateAction<string | null>>] {
  const [managedFilename, setManagedFilename] = useState<string | null>(filename || null);
  const [filenameTruncated, setFilenameTruncated] = useState<string | null>(null);

  useEffect(() => {
    if (!filename) {
      setFilenameTruncated(null);
    } else {
      if (filename.length > 40) {
        setFilenameTruncated(`${filename.substring(0, 25)}...${filename.substring(filename.length - 10)}`);
      } else {
        setFilenameTruncated(filename || '');
      }
    }
  }, [filename]);

  useNonInitialEffect(() => {
    setManagedFilename(filename || null);
  }, [filename]);

  return [{ managedFilename, filenameTruncated }, setManagedFilename];
}
