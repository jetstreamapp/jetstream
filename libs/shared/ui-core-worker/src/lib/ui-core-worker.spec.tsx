import { render } from '@testing-library/react';

import UiCoreWorker from './ui-core-worker';

describe('UiCoreWorker', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<UiCoreWorker />);
    expect(baseElement).toBeTruthy();
  });
});
