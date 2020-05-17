import React from 'react';
import { render } from '@testing-library/react';

import SftoolsUi from './sftools-ui';

describe(' SftoolsUi', () => {
  it('should render successfully', () => {
    const { baseElement } = render(<SftoolsUi />);
    expect(baseElement).toBeTruthy();
  });
});
