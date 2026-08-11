import { InputAcceptType } from '@jetstream/types';

/**
 * Identify pasted clipboard text as a supported file, or null if the caller does not accept anything it looks like.
 * JSON is checked first because it is valid on a single line, which the CSV heuristic would reject.
 */
export function getPastedFile(
  content: string,
  accept?: InputAcceptType[],
): { filename: string; extension: InputAcceptType; content: string } | null {
  if (!content) {
    return null;
  }
  if (accept?.includes('.json') && ['[', '{'].includes(content.trim().charAt(0))) {
    return { filename: 'Clipboard-Paste.json', extension: '.json', content };
  }
  if (accept?.includes('.csv') && content.split('\n').length > 1) {
    return { filename: 'Clipboard-Paste.csv', extension: '.csv', content };
  }
  return null;
}
