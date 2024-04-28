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
    </RadioGroup>
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
    </RadioGroup>
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
