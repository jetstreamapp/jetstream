import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import List from '../List';
import ListItemCheckbox from '../ListItemCheckbox';

function renderItem(onSelected: (key?: string) => void) {
  return render(
    <ul>
      <ListItemCheckbox id="item-1" isActive={false} heading="Account Name" subheading="Name" onSelected={onSelected} />
    </ul>,
  );
}

describe('ListItemCheckbox', () => {
  test('pressing Space on the checkbox toggles selection exactly once', async () => {
    const onSelected = vi.fn();
    renderItem(onSelected);

    const checkbox = screen.getByRole('checkbox', { name: 'Account Name' });
    checkbox.focus();
    // Native checkbox activation fires change AND a bubbled click on the input; the row's click
    // handler must not toggle a second time or the two cancel out
    await userEvent.keyboard(' ');

    expect(onSelected).toHaveBeenCalledTimes(1);
  });

  test('clicking the checkbox visual toggles selection exactly once', async () => {
    const onSelected = vi.fn();
    renderItem(onSelected);

    await userEvent.click(screen.getByRole('checkbox', { name: 'Account Name' }));

    expect(onSelected).toHaveBeenCalledTimes(1);
  });

  test('clicking the row text toggles selection exactly once', async () => {
    const onSelected = vi.fn();
    renderItem(onSelected);

    // Two nodes carry this text: the checkbox's assistive-text label and the visible heading —
    // a sighted mouse user clicks the visible one
    const visibleHeading = screen.getAllByText('Account Name').find((el) => !el.closest('label'))!;
    await userEvent.click(visibleHeading);

    expect(onSelected).toHaveBeenCalledTimes(1);
  });

  test('checkbox is not in the page tab order (list is one tab stop, arrows navigate)', () => {
    renderItem(vi.fn());

    expect(screen.getByRole('checkbox', { name: 'Account Name' }).getAttribute('tabindex')).toBe('-1');
  });
});

describe('List row-local navigation (checkbox mode)', () => {
  function renderList() {
    return render(
      <List
        ariaLabel="Fields"
        useCheckbox
        items={[{ key: 'field-1' }]}
        isActive={() => false}
        getContent={() => ({
          key: 'field-1',
          heading: 'Account Name',
          children: (
            <button type="button" tabIndex={-1}>
              Where is this field used?
            </button>
          ),
        })}
        onSelected={() => undefined}
      />,
    );
  }

  test('ArrowRight moves focus from the checkbox to the row action, ArrowLeft returns', () => {
    renderList();

    const checkbox = screen.getByRole('checkbox', { name: 'Account Name' });
    const rowAction = screen.getByRole('button', { name: 'Where is this field used?' });

    checkbox.focus();
    fireEvent.keyDown(checkbox, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(rowAction);

    fireEvent.keyDown(rowAction, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(checkbox);
  });
});

describe('List row-local navigation (listbox mode)', () => {
  function renderList({ withTrailing = true }: { withTrailing?: boolean } = {}) {
    return render(
      <List
        ariaLabel="Profiles"
        items={[{ key: 'profile-1' }]}
        isActive={() => false}
        getContent={() => ({
          key: 'profile-1',
          heading: 'Admin',
          trailingHeader: withTrailing ? (
            <button type="button" tabIndex={-1}>
              View details
            </button>
          ) : undefined,
        })}
        onSelected={() => undefined}
      />,
    );
  }

  test('ArrowRight moves focus from the option to the trailing action, ArrowLeft returns to the option', () => {
    renderList();

    const option = screen.getByRole('option');
    const rowAction = screen.getByRole('button', { name: 'View details' });

    option.focus();
    fireEvent.keyDown(option, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(rowAction);

    // The option li itself is stop zero — ArrowLeft from the first trailing control must land on it
    fireEvent.keyDown(rowAction, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(option);
  });

  test('a focused option is described by the Right Arrow hint only when it holds a control', () => {
    const { unmount } = renderList({ withTrailing: false });
    const plainOption = screen.getByRole('option');
    plainOption.focus();
    expect(plainOption.hasAttribute('aria-describedby')).toBe(false);
    unmount();

    renderList();
    const option = screen.getByRole('option');
    option.focus();
    const hintId = option.getAttribute('aria-describedby');
    expect(hintId && document.getElementById(hintId)?.textContent).toBe('Press Right Arrow for additional actions');
  });

  test('decorative trailing content does not earn the Right Arrow hint', () => {
    render(
      <List
        ariaLabel="Org groups"
        items={[{ key: 'group-1' }]}
        isActive={() => false}
        getContent={() => ({ key: 'group-1', heading: 'Production', trailingHeader: <span className="slds-badge">3 Orgs</span> })}
        onSelected={() => undefined}
      />,
    );
    const option = screen.getByRole('option');
    option.focus();
    expect(option.hasAttribute('aria-describedby')).toBe(false);
  });

});
