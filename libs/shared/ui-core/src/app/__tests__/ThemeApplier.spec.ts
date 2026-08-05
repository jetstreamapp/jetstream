import { applyThemeBeforeMount } from '../ThemeApplier';

/**
 * `applyThemeBeforeMount(forceScheme)` is the synchronous path - it stamps the body class and
 * updates `<meta name="theme-color">` without touching localforage - so these exercise the
 * theme-color behavior directly.
 */
describe('ThemeApplier - theme-color meta', () => {
  let meta: HTMLMetaElement;

  beforeEach(() => {
    document.head.innerHTML = '';
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.content = '#ffffff';
    document.head.appendChild(meta);

    document.documentElement.style.backgroundColor = '';
    document.body.style.backgroundColor = '';
  });

  it('reads the surface color from <html>, which is where the app paints it', async () => {
    // Regression guard: the app surface lives on <html> (ui-styles/main.css) while <body> only
    // carries the scheme class. Reading <body> alone always yields a transparent color, which left
    // the PWA title bar pinned to the static default forever.
    document.documentElement.style.backgroundColor = 'rgb(24, 24, 24)';

    await applyThemeBeforeMount('dark');

    expect(meta.content).toBe('rgb(24, 24, 24)');
  });

  it('falls back to <body> when only body carries a background', async () => {
    document.body.style.backgroundColor = 'rgb(243, 243, 243)';

    await applyThemeBeforeMount('light');

    expect(meta.content).toBe('rgb(243, 243, 243)');
  });

  it('prefers <html> over <body> when both are painted', async () => {
    document.documentElement.style.backgroundColor = 'rgb(24, 24, 24)';
    document.body.style.backgroundColor = 'rgb(243, 243, 243)';

    await applyThemeBeforeMount('dark');

    expect(meta.content).toBe('rgb(24, 24, 24)');
  });

  it('leaves the existing theme color alone when nothing has painted yet', async () => {
    await applyThemeBeforeMount('light');

    expect(meta.content).toBe('#ffffff');
  });

  it('still applies the scheme class when no theme-color meta exists', async () => {
    document.head.innerHTML = '';

    await applyThemeBeforeMount('dark');

    expect(document.body.classList.contains('slds-color-scheme--dark')).toBe(true);
  });
});
