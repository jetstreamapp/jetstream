import React from 'react';
import { render } from '@testing-library/react';

import SharedNodeUtils from './shared-node-utils';

describe(' SharedNodeUtils', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<SharedNodeUtils />);
    expect(baseElement).toBeTruthy();
  });
});
