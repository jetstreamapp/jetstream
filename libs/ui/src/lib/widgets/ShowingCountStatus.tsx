import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import AssistiveStatus, { FILTER_COUNT_ANNOUNCE_DEBOUNCE_MS } from './AssistiveStatus';

type ShowingCountStatusNoun =
  | {
      /** Noun rendered as-is regardless of count (e.g. "objects"). */
      noun: string;
      singularNoun?: never;
    }
  | {
      /** Singular noun pluralized from `totalCount` (e.g. "field" -> "fields" unless totalCount is 1). */
      singularNoun: string;
      noun?: never;
    };

export type ShowingCountStatusProps = ShowingCountStatusNoun & {
  filteredCount: number;
  totalCount: number;
  /** Wrapper classes for the visible line — the default matches every current call site. */
  className?: string;
};

/**
 * "Showing X of Y <noun>" filter-result count. The visible line and the debounced screen reader
 * announcement render from the SAME string so the two can never drift apart.
 */
export const ShowingCountStatus = ({
  filteredCount,
  totalCount,
  noun,
  singularNoun,
  className = 'slds-text-body_small slds-text-color_weak slds-p-left--xx-small',
}: ShowingCountStatusProps) => {
  const nounText = singularNoun ? pluralizeFromNumber(singularNoun, totalCount) : noun;
  const message = `Showing ${formatNumber(filteredCount)} of ${formatNumber(totalCount)} ${nounText}`;

  return (
    <div className={className}>
      {message}
      <AssistiveStatus debounceMs={FILTER_COUNT_ANNOUNCE_DEBOUNCE_MS} message={message} />
    </div>
  );
};

export default ShowingCountStatus;
