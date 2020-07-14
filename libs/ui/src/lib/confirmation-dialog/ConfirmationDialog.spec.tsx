import React, { Fragment } from 'react';
import { render } from '@testing-library/react';

import ConfirmationDialog from './ConfirmationDialog';

describe(' Modal', () => {
  it('should render successfully', () => {
    const { baseElement } = render(
      <ConfirmationDialog
        header={'header'}
        tagline={'tagline'}
        cancelText={'cancelText'}
        confirmText={'confirmText'}
        onCancel={() => {}}
        onConfirm={() => {}}
      >
        This is a test
      </ConfirmationDialog>
    );
    expect(baseElement).toBeTruthy();
  });
});
