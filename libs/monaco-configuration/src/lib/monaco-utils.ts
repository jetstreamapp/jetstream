import { logger } from '@jetstream/shared/client-logger';
import { Stack } from '@jetstream/shared/utils';
import type { languages } from 'monaco-editor';

interface ApexLogReduceFn {
  reachedExecutionLine: boolean;
  stack: Stack<{ start: number }>;
  foldableRegions: languages.FoldingRange[];
}

const ENTRY_LINE = /(ENTRY|STARTED|BEGIN|CUMULATIVE_LIMIT_USAGE)$/;
const EXIT_LINE = /(EXIT|FINISHED|END|CUMULATIVE_LIMIT_USAGE_END)$/;

/**
 * Get's foldable regions
 * @param log Apex log string
 * @returns
 */
export function getApexLogFoldableRegions(log: string): languages.FoldingRange[] {
  if (!log || !log.length) {
    return [];
  }

  return log.split('\n').reduce(
    (output: ApexLogReduceFn, line, i) => {
      try {
        const { stack, foldableRegions } = output;
        const lineNumber = i + 1;
        if (!output.reachedExecutionLine && !line.includes('|EXECUTION_STARTED')) {
          return output;
        } else if (!output.reachedExecutionLine) {
          output.reachedExecutionLine = true;
        }

        const [timestamp, lineType] = line.split('|');

        if (!lineType) {
          return output;
        }

        if (ENTRY_LINE.test(lineType)) {
          stack.push({ start: lineNumber });
        } else if (EXIT_LINE.test(lineType)) {
          const item = stack.pop();
          // make sure we have an item and that they are more than one away from each other
          if (item && item.start < lineNumber - 1) {
            foldableRegions.push({ ...item, end: lineNumber });
          }
        }
      } catch (ex) {
        logger.warn('[FOLDABLE LOG REGIONS][ERROR]', ex);
      }
      return output;
    },
    {
      reachedExecutionLine: false,
      stack: new Stack<{ start: number }>(),
      foldableRegions: [],
    }
  ).foldableRegions;
}
