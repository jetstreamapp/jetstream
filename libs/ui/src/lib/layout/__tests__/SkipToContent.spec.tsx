import { axeScan } from '@jetstream/test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import SkipToContent, { MAIN_CONTENT_ID } from '../SkipToContent';

function renderWithTarget() {
  return render(
    <div>
      <SkipToContent />
      <main id={MAIN_CONTENT_ID} tabIndex={-1}>
        Content
      </main>
    </div>,
  );
}

describe('SkipToContent', () => {
  test('moves focus to the target without navigating', () => {
    renderWithTarget();

    const link = screen.getByRole('link', { name: 'Skip to main content' });
    // fireEvent returns false when preventDefault was called — the app's <base href> would turn a
    // followed fragment link into a full-page navigation to the home page
    const defaultNotPrevented = fireEvent.click(link);

    expect(defaultNotPrevented).toBe(false);
    expect(document.activeElement?.id).toBe(MAIN_CONTENT_ID);
  });

  test('has no axe violations', async () => {
    const { baseElement } = renderWithTarget();
    const results = await axeScan(baseElement);
    expect(results.violations).toEqual([]);
  });
});
