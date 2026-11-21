const MAX_ATTEMPTS = 20;

/**
 * Moves focus to the first element `findTarget` returns, retrying once per frame for up to ~20 frames.
 *
 * Used when the control that currently has focus unmounts (a form closing after an awaited save), which would drop
 * focus to <body>. The replacement control renders in a later commit, so a single timeout can run before it exists.
 * Returns a cancel function for callers that can unmount first.
 */
export function focusWhenAvailable(findTarget: () => HTMLElement | null | undefined): () => void {
  let attempts = 0;
  let frame = 0;

  function attempt() {
    const target = findTarget();
    if (target) {
      target.focus();
      return;
    }
    attempts += 1;
    if (attempts < MAX_ATTEMPTS) {
      frame = requestAnimationFrame(attempt);
    }
  }

  frame = requestAnimationFrame(attempt);
  return () => cancelAnimationFrame(frame);
}
