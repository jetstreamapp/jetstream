import { axeScan } from '@jetstream/test-utils';
import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Checkbox } from '../checkbox/Checkbox';
import { Combobox } from '../combobox/Combobox';
import { DatePicker } from '../date/DatePicker';
import { Picklist } from '../picklist/Picklist';
import { Radio } from '../radio/Radio';
import { RadioGroup } from '../radio/RadioGroup';
import { Slider } from '../slider/Slider';

const NOOP = () => undefined;

/**
 * Every control that renders an error message must also flag itself invalid: linking the message
 * with aria-describedby alone reads the text but never tells the user the field has a problem.
 */
describe('form controls in an error state', () => {
  test.each([
    {
      name: 'Combobox',
      render: () => (
        <Combobox label="Field" hasError errorMessage="Pick a field" errorMessageId="combobox-error" onKeyboardNavigation={NOOP} />
      ),
      role: 'combobox',
    },
    {
      name: 'Picklist',
      render: () => (
        <Picklist label="Field" items={[]} hasError errorMessage="Pick a field" errorMessageId="picklist-error" onChange={NOOP} />
      ),
      role: 'combobox',
    },
    {
      name: 'Checkbox',
      render: () => <Checkbox id="agree" label="Agree" checked={false} hasError errorMessage="Required" errorMessageId="agree-error" />,
      role: 'checkbox',
    },
    {
      name: 'DatePicker',
      render: () => <DatePicker label="Start" hasError errorMessage="Invalid date" errorMessageId="start-error" onChange={NOOP} />,
      role: 'textbox',
    },
    {
      name: 'RadioGroup',
      render: () => (
        <RadioGroup label="Choice" hasError errorMessage="Choose one">
          <Radio name="choice" label="One" value="one" checked={false} onChange={NOOP} />
        </RadioGroup>
      ),
      role: 'radiogroup',
    },
    {
      name: 'Slider',
      render: () => <Slider id="amount" label="Amount" value="5" hasError errorMessage="Too high" />,
      role: 'slider',
    },
  ])('$name exposes aria-invalid and its error message', async ({ render: renderControl, role }) => {
    const { baseElement } = render(renderControl());
    const control = screen.getByRole(role);
    expect(control.getAttribute('aria-invalid')).toBe('true');
    await axeScan(baseElement);
  });
});
