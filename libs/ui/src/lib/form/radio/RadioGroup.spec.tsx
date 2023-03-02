import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react';
import RadioGroup from './RadioGroup';
import Radio from './Radio';
import { NOOP } from '@jetstream/shared/utils';

const radio = <Radio name="test" label="Radio 1" value="radio1" checked onChange={NOOP} />;

describe('Radio Group Test', () => {
  test('required', async () => {
    render(
      <RadioGroup label="Group label" required labelHelp="helpText">
        {radio}
      </RadioGroup>
    );

    expect(screen.getByText('Group label')).toBeTruthy();
    expect(screen.getByText('helpText')).toBeTruthy();
    expect(screen.getByText('*')).toBeTruthy();
  });

  test('allow classes', async () => {
    const { container } = render(
      <RadioGroup label="Group label" className="outer-class" formControlClassName="form-class">
        {radio}
      </RadioGroup>
    );

    expect(container.querySelector('fieldset.outer-class')).toBeTruthy();
    expect(container.querySelector('div.slds-form-element__control.form-class')).toBeTruthy();
  });

  test('not required', async () => {
    render(<RadioGroup label="Group label">{radio}</RadioGroup>);

    expect(screen.queryAllByText('*').length).toBeFalsy();
  });

  test('error and help text are displayed', async () => {
    const { container } = render(
      <RadioGroup label="Group label" helpText="_HELP_" hasError errorMessage="_ERROR_">
        {radio}
      </RadioGroup>
    );

    expect(screen.getByText('_HELP_')).toBeTruthy();
    expect(screen.getByText('_HELP_').classList.contains('slds-form-element__help')).toBeTruthy();

    expect(screen.getByText('_ERROR_')).toBeTruthy();
    expect(screen.getByText('_ERROR_').classList.contains('slds-form-element__help')).toBeTruthy();

    expect(container.querySelector('fieldset.slds-has-error')).toBeTruthy();
  });

  test('error is not displayed if hasError is false', async () => {
    const { container } = render(
      <RadioGroup label="Group label" errorMessage="_ERROR_">
        {radio}
      </RadioGroup>
    );

    expect(screen.queryAllByText('_ERROR_').length).toBeFalsy();
    expect(container.querySelector('fieldset.slds-has-error')).toBeFalsy();
  });

  test('button group', async () => {
    const { container } = render(
      <RadioGroup label="Group label" isButtonGroup>
        {radio}
      </RadioGroup>
    );

    expect(container.querySelector('.slds-radio_button-group')).toBeTruthy();
  });
});
