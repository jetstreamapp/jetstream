import { axeScan } from '@jetstream/test-utils';
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

  test('arrow keys move between tabs with automatic activation', () => {
    render(<Tabs tabs={tabs} />);

    const alphaTab = screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-controls') === 'tab-alpha')!;

    // Fired on the tab itself so it bubbles to the tablist handler with the tab as event target
    fireEvent.keyDown(alphaTab, { key: 'ArrowRight' });
    expect(screen.getByRole('tabpanel').textContent).toContain('Beta Content');

    const betaTab = screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-controls') === 'tab-beta')!;
    fireEvent.keyDown(betaTab, { key: 'End' });
    expect(screen.getByRole('tabpanel').textContent).toContain('Gamma Content');
  });

  test('only the active tab is in the tab order (roving tabindex)', () => {
    render(<Tabs tabs={tabs} />);

    const tabLinks = screen.getAllByRole('tab');
    expect(tabLinks.filter((tab) => tab.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(tabLinks.filter((tab) => tab.getAttribute('tabindex') === '-1')).toHaveLength(2);
  });

  test('has no axe violations', async () => {
    const { container } = render(<Tabs tabs={tabs} />);
    const results = await axeScan(container);
    expect(results.violations).toEqual([]);
  });

  test('all tab titles are rendered in the tablist', () => {
    render(<Tabs tabs={tabs} />);

    const tabList = screen.getByRole('tablist');
    expect(tabList).toBeTruthy();

    const tabLinks = screen.getAllByRole('tab');
    expect(tabLinks).toHaveLength(3);
  });

  describe('renderAllContent', () => {
    test('renders every tab panel simultaneously', () => {
      render(<Tabs tabs={tabs} renderAllContent />);

      const tabPanels = screen.getAllByRole('tabpanel');
      expect(tabPanels).toHaveLength(3);
      expect(tabPanels[0].textContent).toContain('Alpha Content');
      expect(tabPanels[1].textContent).toContain('Beta Content');
      expect(tabPanels[2].textContent).toContain('Gamma Content');
    });

    test('active panel has slds-show and inactive panels have slds-hide', () => {
      render(<Tabs tabs={tabs} renderAllContent initialActiveId="tab-beta" />);

      const tabPanels = screen.getAllByRole('tabpanel');
      const alphaPanel = tabPanels.find((panel) => panel.id === 'tab-alpha')!;
      const betaPanel = tabPanels.find((panel) => panel.id === 'tab-beta')!;
      const gammaPanel = tabPanels.find((panel) => panel.id === 'tab-gamma')!;

      expect(alphaPanel.className).toContain('slds-hide');
      expect(betaPanel.className).toContain('slds-show');
      expect(gammaPanel.className).toContain('slds-hide');
    });

    test('clicking a tab toggles slds-show/slds-hide without unmounting others', () => {
      render(<Tabs tabs={tabs} renderAllContent />);

      // Initially alpha is active, gamma is hidden but still mounted.
      const initialPanels = screen.getAllByRole('tabpanel');
      expect(initialPanels).toHaveLength(3);

      // Click gamma tab
      const tabLinks = screen.getAllByRole('tab');
      const gammaTab = tabLinks.find((tab) => tab.getAttribute('aria-controls') === 'tab-gamma')!;
      fireEvent.click(gammaTab);

      // All panels should still be in the DOM
      const afterClickPanels = screen.getAllByRole('tabpanel');
      expect(afterClickPanels).toHaveLength(3);

      // Gamma should now be visible, alpha hidden
      const alphaPanel = afterClickPanels.find((panel) => panel.id === 'tab-alpha')!;
      const gammaPanel = afterClickPanels.find((panel) => panel.id === 'tab-gamma')!;
      expect(alphaPanel.className).toContain('slds-hide');
      expect(gammaPanel.className).toContain('slds-show');
    });
  });
});
