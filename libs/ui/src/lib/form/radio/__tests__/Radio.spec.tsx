import { axeScan } from '@jetstream/test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import Radio from '../Radio';
import RadioGroup from '../RadioGroup';

test('changing checkbox should change active item', async () => {
  let activeValue = 'radio1';

  const { rerender } = render(
    <RadioGroup label="Group label" required={false} hasError={false} errorMessage={undefined}>
      <Radio
        name="test"
        label="Radio 1"
        value="radio1"
        disabled={false}
        checked={activeValue === 'radio1'}
        onChange={(value) => (activeValue = value)}
      />
      <Radio
        name="test"
        label="Radio 2"
        value="radio2"
        disabled={false}
        checked={activeValue === 'radio2'}
        onChange={(value) => (activeValue = value)}
      />
    </RadioGroup>,
  );

  expect(screen.getByRole('radio', { checked: true }).getAttribute('value')).toEqual('radio1');
  expect(screen.getByRole('radio', { checked: false }).getAttribute('value')).toEqual('radio2');

  fireEvent.click(screen.getByRole('radio', { checked: false }));
  rerender(
    <RadioGroup label="Group label" required={false} hasError={false} errorMessage={undefined}>
      <Radio
        name="test"
        label="Radio 1"
        value="radio1"
        disabled={false}
        checked={activeValue === 'radio1'}
        onChange={(value) => (activeValue = value)}
      />
      <Radio
        name="test"
        label="Radio 2"
        value="radio2"
        disabled={false}
        checked={activeValue === 'radio2'}
        onChange={(value) => (activeValue = value)}
      />
    </RadioGroup>,
  );

  expect(screen.getByRole('radio', { checked: true }).getAttribute('value')).toEqual('radio2');
  expect(screen.getByRole('radio', { checked: false }).getAttribute('value')).toEqual('radio1');
});

// TODO:

// test('disabled should be honored', async () => {
//   // let activeValue = 'radio1';
//   // const { rerender } = render(
//   //   <RadioGroup label="Group label" required={false} hasError={false} errorMessage={undefined}>
//   //     <Radio
//   //       name="test"
//   //       label="Radio 1"
//   //       value="radio1"
//   //       disabled={false}
//   //       checked={activeValue === 'radio1'}
//   //       onChange={(value) => (activeValue = value)}
//   //     />
//   //     <Radio
//   //       name="test"
//   //       label="Radio 2"
//   //       value="radio2"
//   //       disabled={false}
//   //       checked={activeValue === 'radio2'}
//   //       onChange={(value) => (activeValue = value)}
//   //     />
//   //   </RadioGroup>
//   // );
//   // expect(screen.getByRole('radio', { checked: true }).getAttribute('value')).toEqual('radio1');
//   // expect(screen.getByRole('radio', { checked: false }).getAttribute('value')).toEqual('radio2');
// });

test('hideLabel keeps the group name for assistive technology only', async () => {
  const { baseElement } = render(
    <RadioGroup label="View" hideLabel isButtonGroup>
      <Radio name="view" label="Edited" value="edited" checked onChange={() => undefined} />
    </RadioGroup>,
  );

  const group = screen.getByRole('radiogroup', { name: 'View' });
  expect(group.querySelector('legend')?.className).toContain('slds-assistive-text');
  await axeScan(baseElement);
});

test('a group that also holds other controls keeps the native group role', async () => {
  const { baseElement } = render(
    <RadioGroup label="Map to Lookup Options" hasNonRadioControls>
      <Radio name="lookup" label="Use first found record" value="FIRST" checked onChange={() => undefined} />
      <input type="checkbox" aria-label="Set value to null if no match is found" />
    </RadioGroup>,
  );

  expect(screen.queryByRole('radiogroup')).toBeNull();
  expect(screen.getByRole('group', { name: 'Map to Lookup Options' })).toBeTruthy();
  await axeScan(baseElement);
});
