export interface AssistiveStatusProps {
  message: string;
}

/**
 * Visually-hidden live region for announcing async state transitions (loading started/finished).
 *
 * Keep this MOUNTED across the whole transition and change only `message` — a live region that is
 * inserted into the DOM already containing its text (e.g. a spinner with baked-in "Loading"
 * assistive text) is unreliably announced, and an unmounting spinner announces nothing at all.
 */
export const AssistiveStatus = ({ message }: AssistiveStatusProps) => (
  <span role="status" aria-live="polite" aria-atomic="true" className="slds-assistive-text">
    {message}
  </span>
);

export default AssistiveStatus;
