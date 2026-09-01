import { axeScan } from '@jetstream/test-utils';
import { UiSection } from '@jetstream/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { Accordion } from '../Accordion';

const sections: UiSection[] = [
  { id: 'section-1', title: 'Section One', content: <p>Content One</p> },
  { id: 'section-2', title: 'Section Two', content: <p>Content Two</p> },
  { id: 'section-3', title: 'Section Three', content: <p>Content Three</p> },
];

describe('Accordion', () => {
  // jsdom does not implement scrollIntoView, so the tests that cover it provide their own
  const originalScrollIntoView = Element.prototype.scrollIntoView;
  afterEach(() => {
    Element.prototype.scrollIntoView = originalScrollIntoView;
  });

  function stubScrollIntoView() {
    const scrolledElements: Element[] = [];
    Element.prototype.scrollIntoView = vi.fn(function scrollIntoViewStub(this: Element) {
      scrolledElements.push(this);
    });
    return scrolledElements;
  }

  test('renders all section titles', () => {
    render(<Accordion sections={sections} initOpenIds={[]} />);

    expect(screen.getByText('Section One')).toBeTruthy();
    expect(screen.getByText('Section Two')).toBeTruthy();
    expect(screen.getByText('Section Three')).toBeTruthy();
  });

  test('sections in initOpenIds are initially open', () => {
    render(<Accordion sections={sections} initOpenIds={['section-1', 'section-2']} />);

    const buttons = screen.getAllByRole('button');
    const sectionOneBtn = buttons.find((btn) => btn.getAttribute('aria-controls') === 'section-1');
    const sectionTwoBtn = buttons.find((btn) => btn.getAttribute('aria-controls') === 'section-2');

    expect(sectionOneBtn?.getAttribute('aria-expanded')).toBe('true');
    expect(sectionTwoBtn?.getAttribute('aria-expanded')).toBe('true');
  });

  test('sections NOT in initOpenIds are initially closed', () => {
    render(<Accordion sections={sections} initOpenIds={['section-1']} />);

    const buttons = screen.getAllByRole('button');
    const sectionThreeBtn = buttons.find((btn) => btn.getAttribute('aria-controls') === 'section-3');

    expect(sectionThreeBtn?.getAttribute('aria-expanded')).toBe('false');
  });

  test('clicking a closed section opens it', () => {
    render(<Accordion sections={sections} initOpenIds={[]} />);

    const buttons = screen.getAllByRole('button');
    const sectionOneBtn = buttons.find((btn) => btn.getAttribute('aria-controls') === 'section-1')!;

    expect(sectionOneBtn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(sectionOneBtn);
    expect(sectionOneBtn.getAttribute('aria-expanded')).toBe('true');
  });

  test('clicking an open section closes it', () => {
    render(<Accordion sections={sections} initOpenIds={['section-2']} />);

    const buttons = screen.getAllByRole('button');
    const sectionTwoBtn = buttons.find((btn) => btn.getAttribute('aria-controls') === 'section-2')!;

    expect(sectionTwoBtn.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(sectionTwoBtn);
    expect(sectionTwoBtn.getAttribute('aria-expanded')).toBe('false');
  });

  test('with allowMultiple=false, opening a section closes the others', () => {
    render(<Accordion sections={sections} initOpenIds={['section-1']} allowMultiple={false} />);

    const buttons = screen.getAllByRole('button');
    const sectionOneBtn = buttons.find((btn) => btn.getAttribute('aria-controls') === 'section-1')!;
    const sectionTwoBtn = buttons.find((btn) => btn.getAttribute('aria-controls') === 'section-2')!;

    expect(sectionOneBtn.getAttribute('aria-expanded')).toBe('true');

    fireEvent.click(sectionTwoBtn);

    expect(sectionOneBtn.getAttribute('aria-expanded')).toBe('false');
    expect(sectionTwoBtn.getAttribute('aria-expanded')).toBe('true');
  });

  test('onActiveIdsChange is called when a section is toggled', () => {
    const handleChange = vi.fn();
    render(<Accordion sections={sections} initOpenIds={[]} onActiveIdsChange={handleChange} />);

    const buttons = screen.getAllByRole('button');
    const sectionOneBtn = buttons.find((btn) => btn.getAttribute('aria-controls') === 'section-1')!;

    fireEvent.click(sectionOneBtn);

    expect(handleChange).toHaveBeenCalledOnce();
    expect(handleChange).toHaveBeenCalledWith(['section-1']);
  });

  test('Expand All button shows when showExpandCollapseAll=true and not all sections are open', () => {
    render(<Accordion sections={sections} initOpenIds={[]} showExpandCollapseAll />);

    expect(screen.getByTitle('Expand All')).toBeTruthy();
  });

  test('clicking Expand All opens all sections', () => {
    render(<Accordion sections={sections} initOpenIds={[]} showExpandCollapseAll />);

    fireEvent.click(screen.getByTitle('Expand All'));

    const buttons = screen.getAllByRole('button');
    const sectionButtons = buttons.filter((btn) => btn.getAttribute('aria-controls'));

    sectionButtons.forEach((btn) => {
      expect(btn.getAttribute('aria-expanded')).toBe('true');
    });
  });

  test('clicking Collapse All closes all sections', () => {
    render(<Accordion sections={sections} initOpenIds={['section-1', 'section-2', 'section-3']} showExpandCollapseAll />);

    expect(screen.getByTitle('Collapse All')).toBeTruthy();
    fireEvent.click(screen.getByTitle('Collapse All'));

    const buttons = screen.getAllByRole('button');
    const sectionButtons = buttons.filter((btn) => btn.getAttribute('aria-controls'));

    sectionButtons.forEach((btn) => {
      expect(btn.getAttribute('aria-expanded')).toBe('false');
    });
  });

  test('scrollInitOpenIdIntoView scrolls the section opened on mount into view', () => {
    const scrolledElements = stubScrollIntoView();

    render(<Accordion sections={sections} initOpenIds={['section-2']} scrollInitOpenIdIntoView />);

    expect(scrolledElements).toHaveLength(1);
    expect(scrolledElements[0].contains(screen.getByText('Content Two'))).toBe(true);
  });

  test('nothing is scrolled into view without scrollInitOpenIdIntoView', () => {
    const scrolledElements = stubScrollIntoView();

    render(<Accordion sections={sections} initOpenIds={['section-2']} />);

    expect(scrolledElements).toHaveLength(0);
  });
});

describe('Accordion singleTabStop composite', () => {
  function renderComposite({ singleTabStop = true, disabledIds = [] as string[], initOpenIds = [] as string[] } = {}) {
    return render(
      <Accordion
        initOpenIds={initOpenIds}
        allowMultiple={false}
        singleTabStop={singleTabStop}
        sections={['Contacts', 'Cases', 'Opportunities'].map((id) => ({
          id,
          title: id,
          titleText: id,
          disabled: disabledIds.includes(id),
          content: <button type="button">{id} embedded control</button>,
        }))}
      />,
    );
  }

  test('default mode keeps a tab stop per header', () => {
    renderComposite({ singleTabStop: false });
    const headers = screen.getAllByRole('button', { name: /Contacts|Cases|Opportunities/ });
    headers.forEach((header) => expect(header.getAttribute('tabindex')).toBeNull());
  });

  test('exactly one header is in the page tab order', () => {
    renderComposite();
    expect(screen.getByRole('button', { name: 'Contacts' }).tabIndex).toBe(0);
    expect(screen.getByRole('button', { name: 'Cases' }).tabIndex).toBe(-1);
    expect(screen.getByRole('button', { name: 'Opportunities' }).tabIndex).toBe(-1);
  });

  test('the initially open section is the tab stop, so tabbing in lands where the user left off', () => {
    renderComposite({ initOpenIds: ['Cases'] });
    expect(screen.getByRole('button', { name: 'Cases' }).tabIndex).toBe(0);
  });

  test('ArrowDown/ArrowUp move focus between headers and wrap at the ends', () => {
    renderComposite();
    const contacts = screen.getByRole('button', { name: 'Contacts' });
    const cases = screen.getByRole('button', { name: 'Cases' });
    const opportunities = screen.getByRole('button', { name: 'Opportunities' });

    contacts.focus();
    fireEvent.keyDown(contacts, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(cases);
    expect(cases.tabIndex).toBe(0);
    expect(contacts.tabIndex).toBe(-1);

    fireEvent.keyDown(cases, { key: 'ArrowUp' });
    fireEvent.keyDown(contacts, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(opportunities);

    fireEvent.keyDown(opportunities, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(contacts);
  });

  test('Home and End jump to the first and last enabled headers', () => {
    renderComposite();
    const contacts = screen.getByRole('button', { name: 'Contacts' });
    contacts.focus();
    fireEvent.keyDown(contacts, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Opportunities' }));
    fireEvent.keyDown(document.activeElement as Element, { key: 'Home' });
    expect(document.activeElement).toBe(contacts);
  });

  test('disabled sections are skipped by arrow navigation', () => {
    renderComposite({ disabledIds: ['Cases'] });
    const contacts = screen.getByRole('button', { name: 'Contacts' });
    contacts.focus();
    fireEvent.keyDown(contacts, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Opportunities' }));
  });

  test('clicking a header toggles it and moves the roving tab stop there', () => {
    renderComposite();
    const cases = screen.getByRole('button', { name: 'Cases' });
    fireEvent.click(cases);
    expect(cases.getAttribute('aria-expanded')).toBe('true');
    expect(cases.tabIndex).toBe(0);
    expect(screen.getByRole('button', { name: 'Contacts' }).tabIndex).toBe(-1);
  });

  test('arrow keys inside an open section content are left to the content', () => {
    renderComposite();
    fireEvent.click(screen.getByRole('button', { name: 'Contacts' }));
    const embedded = screen.getByRole('button', { name: 'Contacts embedded control' });
    embedded.focus();
    fireEvent.keyDown(embedded, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(embedded);
  });

  test('has no axe violations', async () => {
    const { baseElement } = renderComposite({ initOpenIds: ['Contacts'] });
    const results = await axeScan(baseElement);
    expect(results.violations).toEqual([]);
  });
});
