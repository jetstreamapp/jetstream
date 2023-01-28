import { render } from '@testing-library/react';
import React from 'react';

// TODO:
describe(' Modal', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<div></div>);
    expect(baseElement).toBeTruthy();
  });
});
