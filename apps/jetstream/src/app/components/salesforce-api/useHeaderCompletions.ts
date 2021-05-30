// import { logger } from '@jetstream/shared/client-logger';
// import { apexCompletions } from '@jetstream/shared/data';
// import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
// import { ApexCompletion, ApexCompletionResponse, MapOf, SalesforceOrgUi } from '@jetstream/types';
// import { useCallback, useEffect, useRef, useState } from 'react';
// // TODO: make this monaco compatible
// const HEADERS = [
//   'Accept',
//   'Accept-Ranges',
//   'Access-Control-Max-Age',
//   'Content-Disposition',
//   'Content-Encoding',
//   'Content-Language',
//   'Content-Location',
//   'Content-MD5',
//   'Content-Range',
//   'Content-Type',
//   'Date',
//   'ETag',
//   'If-Match',
//   'If-Modified-Since',
//   'If-None-Match',
//   'If-Unmodified-Since',
//   'Last-Modified',
//   'Sforce-Auto-Assign',
//   'Sforce-Call-Options',
//   'Sforce-Limit-Info',
//   'Sforce-Query-Options',
//   'X-Content-Type-Options',
//   'X-PrettyPrint',
//   'x-sfdc-packageversion-clientPackage',
// ];

// const HEADER_VALUES = {
//   accept: ['application/json', 'application/xml', 'text/csv', 'text/plain', 'text/xml'],
//   'content-type': ['application/json', 'application/xml', 'text/csv', 'text/plain', 'text/xml'],
//   'sforce-call-options': ['client', 'defaultNamespace='],
//   'sforce-limit-info': ['api-usage'],
//   'sforce-query-options': ['batchSize='],
//   'x-prettyprint': ['1'],
// };

// /**
//  * Fetch completions from Salesforce
//  *
//  * @param org
//  * @returns
//  */
// export function useHeaderCompletions() {
//   /**
//    * Return code completions for text at current cursor
//    */
//   const hint = useCallback(async (editor: Editor, options: EditorConfiguration) => {
//     const cursor = editor.getCursor();
//     const line = editor.getLine(cursor.line);
//     let start = cursor.ch;
//     let end = cursor.ch;
//     try {
//       while (start && /\w/.test(line.charAt(start - 1))) {
//         --start;
//       }
//       while (end < line.length && /\w/.test(line.charAt(end))) {
//         ++end;
//       }

//       const priorWord = line.slice(0, start).toLowerCase().trim();
//       const word = line.slice(start, end).toLowerCase();
//       const needsQuotes = line.slice(start - 1, start) !== `"`;

//       let completions: string[] = [];

//       if (priorWord && Object.keys(HEADER_VALUES).some((key) => priorWord.includes(key))) {
//         const match = Object.keys(HEADER_VALUES).find((key) => priorWord.includes(key));
//         completions = HEADER_VALUES[match] || [];
//       } else if (!word) {
//         completions = [...HEADERS];
//       } else {
//         completions = [...HEADERS].filter((key) => key.toLowerCase().startsWith(word));
//       }
//       if (needsQuotes) {
//         completions = completions.map((item) => `"${item}"`);
//       }
//       return { list: completions, from: Pos(cursor.line, start), to: Pos(cursor.line, end) };
//     } catch (ex) {
//       logger.log(ex);
//       return { list: [], from: Pos(cursor.line, start), to: Pos(cursor.line, end) };
//     }
//   }, []);

//   return { hint };
// }
