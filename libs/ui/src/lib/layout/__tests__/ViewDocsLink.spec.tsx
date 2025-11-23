import { render, screen } from '@testing-library/react';
import { ViewDocsLink } from '../ViewDocsLink';

describe('ViewDocsLink', () => {
  test('Relative path', async () => {
    const path = '/test-docs';
    render(<ViewDocsLink className="my-class" path={path} textReset />);

    expect(screen.getByRole('link', { name: /documentation/i }).getAttribute('href')).toEqual(`https://docs.getjetstream.app${path}`);
    expect(screen.getByRole('link', { name: /documentation/i }).classList.contains('my-class')).toEqual(true);
    expect(screen.getByRole('link', { name: /documentation/i }).classList.contains('slds-text-body_regular')).toEqual(true);
  });

  test('Absolute allowed path', async () => {
    const path = 'https://docs.getjetstream.app/deploy-fields';
    render(<ViewDocsLink path={path} />);

    expect(screen.getByRole('link', { name: /documentation/i }).getAttribute('href')).toEqual(path);
    expect(screen.getByRole('link', { name: /documentation/i }).classList.contains('my-class')).toEqual(false);
    expect(screen.getByRole('link', { name: /documentation/i }).classList.contains('slds-text-body_regular')).toEqual(false);
  });

  test('Nothing rendered if host is invalid', async () => {
    const path = 'https://getjetstream.app/deploy-fields';
    render(<ViewDocsLink path={path} />);

    expect(screen.queryByRole('link', { name: /documentation/i })).toBeNull();
  });

  test('Nothing rendered if path is invalid', async () => {
    const path = 'ftp://docs.getjetstream.app/deploy-fields';
    render(<ViewDocsLink path={path} />);

    expect(screen.getByRole('link', { name: /documentation/i }).getAttribute('href')).toEqual(
      `https://docs.getjetstream.app/deploy-fields`,
    );
  });
});
