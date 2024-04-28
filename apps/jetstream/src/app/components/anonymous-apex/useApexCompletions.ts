// import { logger } from '@jetstream/shared/client-logger';
// import { apexCompletions } from '@jetstream/shared/data';
// import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
// import { ApexCompletion, ApexCompletionResponse, MapOf, SalesforceOrgUi } from '@jetstream/types';
// import { useCallback, useEffect, useRef, useState } from 'react';

// // keep track of shared promise in case multiple requests come - this is a slow response
// // after initial, the cache is used for the response
// let completionsPromise: Promise<ApexCompletionResponse>;

// /**
//  * Fetch completions from Salesforce
//  *
//  * @param org
//  * @returns
//  */
// export function useApexCompletions(org: SalesforceOrgUi) {
//   const isMounted = useRef(true);
//   const [_completions, setCompletions] = useState<Record<string, ApexCompletion>>(null);
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     isMounted.current = true;
//     return () => {
//       isMounted.current = false;
//       completionsPromise = null;
//     };
//   }, []);

//   useNonInitialEffect(() => {
//     setCompletions(null);
//     // eagerly fetch // TODO: do something to avoid a fetch while another fetch is in progress!
//     fetchCompletions();
//   }, [org]);

//   const fetchCompletions = useCallback(async () => {
//     try {
//       setLoading(true);
//       setCompletions(null);
//       if (!completionsPromise) {
//         completionsPromise = apexCompletions(org);
//       }
//       const { publicDeclarations } = await completionsPromise;
//       const completions = publicDeclarations.System;
//       if (isMounted.current) {
//         setCompletions(completions);
//       }
//       setLoading(false);
//       completionsPromise = null;
//       return completions;
//     } catch (ex) {
//       // fail silently - we fallback to no completions instead of presenting an error to the user
//       setLoading(false);
//       completionsPromise = null;
//     }
//   }, [org]);

//   const getCompletions = useCallback(async () => {
//     try {
//       if (_completions) {
//         return _completions;
//       }
//       return await fetchCompletions();
//     } catch (ex) {
//       return null;
//     }
//   }, [_completions, fetchCompletions]);

//   /**
//    * Return code completions for text at current cursor
//    */
//   const hint = useCallback(
//     async (editor: Editor, options: EditorConfiguration) => {
//       const cursor = editor.getCursor();
//       const line = editor.getLine(cursor.line);
//       let start = cursor.ch;
//       let end = cursor.ch;
//       try {
//         const completions = await getCompletions();

//         while (start && /\w/.test(line.charAt(start - 1))) {
//           --start;
//         }
//         while (end < line.length && /\w/.test(line.charAt(end))) {
//           ++end;
//         }
//         const priorWord = line.slice(0, start).toLowerCase().trim();
//         const word = line.slice(start, end).toLowerCase();

//         let completionList: string[] = [];

//         if (!priorWord && !word) {
//           completionList = Object.keys(completions).concat(
//             completions.System.methods.map((item) => `System.${item.name}(${item.parameters.map((param) => `'${param.name}'`).join(', ')})`)
//           );
//         } else if (!priorWord) {
//           completionList = Object.keys(completions)
//             .filter((key) => key.toLowerCase().startsWith(word))
//             .concat(
//               completions.System.methods
//                 .filter((item) => item.name.toLowerCase().startsWith(word))
//                 .map((item) => `System.${item.name}(${item.parameters.map((param) => `'${param.name}'`).join(', ')})`)
//             );
//         } else if (priorWord.includes('.')) {
//           const priorWords = priorWord.split('.').filter((item) => !!item);
//           // We don't have enough information to do any more than one depth of completions
//           if (priorWords.length === 1) {
//             const foundKey = Object.keys(completions).find((key) => key.toLowerCase() === priorWords[0]);
//             completionList = completions[foundKey].properties
//               .map((item) => item.name)
//               .concat(
//                 completions[foundKey].methods.map((item) => `${item.name}(${item.parameters.map((param) => `'${param.name}'`).join(', ')})`)
//               );

//             if (word) {
//               completionList = completionList.filter((item) => item.toLowerCase().startsWith(word));
//             }
//           }
//         }
//         logger.log({ completionList });
//         // remove duplicates and fix some invalid casing that SFDC has
//         const completionListSet = new Set(completionList);
//         if (completionListSet.has('LIST')) {
//           completionListSet.delete('LIST');
//           completionListSet.add('List');
//         }
//         return { list: Array.from(completionListSet), from: Pos(cursor.line, start), to: Pos(cursor.line, end) };
//       } catch (ex) {
//         logger.log(ex);
//         return { list: [], from: Pos(cursor.line, start), to: Pos(cursor.line, end) };
//       }
//     },
//     [getCompletions]
//   );

//   return { hint, loading, getCompletions };
// }
