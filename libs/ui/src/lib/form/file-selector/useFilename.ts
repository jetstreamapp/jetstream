import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { Maybe } from '@jetstream/types';
import { Dispatch, SetStateAction, useState } from 'react';

export function useFilename(
  filename: Maybe<string>,
): [{ managedFilename: Maybe<string>; filenameTruncated: Maybe<string> }, Dispatch<SetStateAction<Maybe<string>>>] {
  const [managedFilename, setManagedFilename] = useState<Maybe<string>>(filename || null);

  const _filename = filename || managedFilename || '';
  const filenameTruncated =
    _filename.length > 40 ? `${_filename.substring(0, 25)}...${_filename.substring(_filename.length - 10)}` : _filename || null;

  useNonInitialEffect(() => {
    setManagedFilename(filename || null);
  }, [filename]);

  return [{ managedFilename, filenameTruncated }, setManagedFilename];
}
