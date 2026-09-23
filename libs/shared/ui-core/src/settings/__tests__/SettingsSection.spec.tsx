import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SettingsToggleRow } from '../layout/SettingsSection';
import { SalesforceAutoLoginSetting } from '../SalesforceAutoLoginSetting';

describe('SettingsToggleRow', () => {
  it('names the toggle with the row title and describes it with the row description', () => {
    render(<SettingsToggleRow id="example" title="Example setting" description="What it does" checked={false} onChange={vi.fn()} />);
    const toggle = screen.getByRole('checkbox', { name: 'Example setting' });
    expect(toggle.getAttribute('aria-describedby')?.split(' ')).toContain('example-description');
    expect(screen.getByText('What it does').id).toBe('example-description');
  });
});

describe('SalesforceAutoLoginSetting', () => {
  it('shows auto login as on when frontdoor login is not skipped', () => {
    render(<SalesforceAutoLoginSetting skipFrontdoorLogin={false} onChange={vi.fn()} />);
    expect((screen.getByRole('checkbox', { name: /Log in automatically/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('saves turning auto login off as skipping frontdoor login', () => {
    const onChange = vi.fn();
    render(<SalesforceAutoLoginSetting skipFrontdoorLogin={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: /Log in automatically/ }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
