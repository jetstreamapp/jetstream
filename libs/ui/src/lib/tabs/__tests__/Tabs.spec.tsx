import { UiTabSection } from '@jetstream/types';
import { fireEvent, render, screen } from '@testing-library/react';
import Tabs from '../Tabs';

const tabs: UiTabSection[] = [
  { id: 'tab-alpha', title: 'Alpha', content: <p>Alpha Content</p> },
  { id: 'tab-beta', title: 'Beta', content: <p>Beta Content</p> },
  { id: 'tab-gamma', title: 'Gamma', content: <p>Gamma Content</p> },
];

describe('Tabs', () => {
  test('renders all tab titles', () => {
    render(<Tabs tabs={tabs} />);

    expect(screen.getByText('Alpha')).toBeTruthy();
    expect(screen.getByText('Beta')).toBeTruthy();
    expect(screen.getByText('Gamma')).toBeTruthy();
  });

  test('first tab is active by default', () => {
    render(<Tabs tabs={tabs} />);

    const tabLinks = screen.getAllByRole('tab');
    const firstTab = tabLinks.find((tab) => tab.getAttribute('aria-controls') === 'tab-alpha');

    expect(firstTab?.getAttribute('aria-selected')).toBe('true');
  });

  test('active tab content is shown in tabpanel', () => {
    render(<Tabs tabs={tabs} />);

    const tabPanel = screen.getByRole('tabpanel');
    expect(tabPanel.textContent).toContain('Alpha Content');
  });

  test('clicking a tab switches the active tab', () => {
    render(<Tabs tabs={tabs} />);

    const tabLinks = screen.getAllByRole('tab');
    const betaTab = tabLinks.find((tab) => tab.getAttribute('aria-controls') === 'tab-beta')!;

    fireEvent.click(betaTab);

    const tabPanel = screen.getByRole('tabpanel');
    expect(tabPanel.textContent).toContain('Beta Content');
  });

  test('onChange is called with the clicked tab id', () => {
    const handleChange = vi.fn();
    render(<Tabs tabs={tabs} onChange={handleChange} />);

    const tabLinks = screen.getAllByRole('tab');
    const betaTab = tabLinks.find((tab) => tab.getAttribute('aria-controls') === 'tab-beta')!;

    fireEvent.click(betaTab);

    expect(handleChange).toHaveBeenCalledOnce();
    expect(handleChange).toHaveBeenCalledWith('tab-beta');
  });

  test('initialActiveId sets the initially active tab', () => {
    render(<Tabs tabs={tabs} initialActiveId="tab-gamma" />);

    const tabLinks = screen.getAllByRole('tab');
    const gammaTab = tabLinks.find((tab) => tab.getAttribute('aria-controls') === 'tab-gamma');

    expect(gammaTab?.getAttribute('aria-selected')).toBe('true');

    const tabPanel = screen.getByRole('tabpanel');
    expect(tabPanel.textContent).toContain('Gamma Content');
  });

  test('all tab titles are rendered in the tablist', () => {
    render(<Tabs tabs={tabs} />);

    const tabList = screen.getByRole('tablist');
    expect(tabList).toBeTruthy();

    const tabLinks = screen.getAllByRole('tab');
    expect(tabLinks).toHaveLength(3);
  });
});
