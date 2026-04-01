import { UiSection } from '@jetstream/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { Accordion } from '../Accordion';

const sections: UiSection[] = [
  { id: 'section-1', title: 'Section One', content: <p>Content One</p> },
  { id: 'section-2', title: 'Section Two', content: <p>Content Two</p> },
  { id: 'section-3', title: 'Section Three', content: <p>Content Three</p> },
];

describe('Accordion', () => {
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
});
