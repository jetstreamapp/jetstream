import { readFile } from '@jetstream/shared/ui-utils';
import { InputAcceptType, InputReadFileContent } from '@jetstream/types';

export const SCRIPT_LOAD_ERR_MESSAGE = 'There was an error initializing Google.';
export const AUTH_ERR_MESSAGE = 'There was an error authenticating with Google.';

/** Everything else is read as an ArrayBuffer, which is what the xlsx/zip parsers expect */
const TEXT_FILE_EXTENSIONS: InputAcceptType[] = ['.csv', '.tsv', '.xml', '.json'];

export function getFileExtension(filename: string): InputAcceptType {
  const lastDotIndex = filename.lastIndexOf('.');
  // Without an explicit check a dotless filename would be returned in full, since substring(-1) starts at zero
  return (lastDotIndex === -1 ? '' : filename.substring(lastDotIndex).toLowerCase()) as InputAcceptType;
}

/**
 * Validate a file against the allowed types/size and read it in the format the parsers expect.
 * Shared by the file input and by any drop target that accepts files on behalf of one.
 * Throws with a user-facing message when the file is not allowed.
 */
export async function readFileForUpload(
  file: File,
  { accept, maxAllowedSizeMB }: { accept?: InputAcceptType[]; maxAllowedSizeMB?: number } = {},
): Promise<InputReadFileContent> {
  const extension = getFileExtension(file.name);

  if (accept && !accept.includes(extension)) {
    // A file with no extension has nothing to name in the message, so say what is accepted instead
    const problem = extension ? `File type ${extension} is not supported` : 'This file does not have a file extension';
    throw new Error(`${problem}. Choose a ${accept.join(', ')} file.`);
  }
  if (maxAllowedSizeMB && file.size / 1000 / 1000 > maxAllowedSizeMB) {
    throw new Error(`Maximum allowed file size is ${maxAllowedSizeMB}MB`);
  }

  const content = await (TEXT_FILE_EXTENSIONS.includes(extension) ? readFile(file, 'text') : readFile(file, 'array_buffer'));
  return { filename: file.name, extension, content };
}
