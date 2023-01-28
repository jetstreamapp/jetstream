import { getByText, render, waitFor } from '@testing-library/react';

describe('App', () => {
  it('should render successfully', async () => {
    const { baseElement } = render(<div>my message</div>);
    await waitFor(() => getByText(baseElement, 'my message'));
  });
});
