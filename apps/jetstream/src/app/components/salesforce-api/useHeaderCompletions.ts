import { logger } from '@jetstream/shared/client-logger';
import { apexCompletions } from '@jetstream/shared/data';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { ApexCompletion, ApexCompletionResponse, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { Editor, EditorConfiguration, Pos } from 'codemirror';
import { useCallback, useEffect, useRef, useState } from 'react';

const HEADERS = [
  'Accept',
  'Accept-Ranges',
  'Access-Control-Allow-Credentials',
  'Access-Control-Allow-Headers',
  'Access-Control-Allow-Methods',
  'Access-Control-Allow-Origin',
  'Access-Control-Expose-Headers',
  'Access-Control-Max-Age',
  'Content-Disposition',
  'Content-Encoding',
  'Content-Language',
  'Content-Location',
  'Content-MD5',
  'Content-Range',
  'Content-Type',
  'Date',
  'ETag',
  'If-Match',
  'If-Modified-Since',
  'If-None-Match',
  'If-Unmodified-Since',
  'Last-Modified',
  'Sforce-Auto-Assign',
  'Sforce-Call-Options',
  'Sforce-Limit-Info',
  'Sforce-Query-Options',
  'X-Content-Type-Options',
  'X-PrettyPrint',
  'x-sfdc-packageversion-clientPackage',
];

/**
 * Fetch completions from Salesforce
 *
 * @param org
 * @returns
 */
export function useHeaderCompletions() {
  /**
   * Return code completions for text at current cursor
   */
  const hint = useCallback(async (editor: Editor, options: EditorConfiguration) => {
    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    let start = cursor.ch;
    let end = cursor.ch;
    try {
      while (start && /\w/.test(line.charAt(start - 1))) {
        --start;
      }
      while (end < line.length && /\w/.test(line.charAt(end))) {
        ++end;
      }
      // TODO: could try to give suggested values based on header key?
      // TODO: what about handling double parens?
      const priorWord = line.slice(0, start).toLowerCase().trim();
      const word = line.slice(start, end).toLowerCase();

      let completions: string[] = [];

      if (!word) {
        completions = [...HEADERS];
      } else {
        completions = [...HEADERS].filter((key) => key.toLowerCase().startsWith(word));
      }
      return { list: completions, from: Pos(cursor.line, start), to: Pos(cursor.line, end) };
    } catch (ex) {
      logger.log(ex);
      return { list: [], from: Pos(cursor.line, start), to: Pos(cursor.line, end) };
    }
  }, []);

  return { hint };
}
