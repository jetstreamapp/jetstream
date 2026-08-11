import { getPastedFile } from '../getPastedFile';

describe('getPastedFile', () => {
  it('should return null for empty content', () => {
    expect(getPastedFile('', ['.csv', '.json'])).toBeNull();
  });

  it('should return null when nothing is accepted', () => {
    expect(getPastedFile('[{"Id":"001"}]', undefined)).toBeNull();
    expect(getPastedFile('[{"Id":"001"}]', ['.xlsx'])).toBeNull();
  });

  it('should detect a JSON array', () => {
    expect(getPastedFile('[{"Id":"001"}]', ['.csv', '.json'])).toEqual({
      filename: 'Clipboard-Paste.json',
      extension: '.json',
      content: '[{"Id":"001"}]',
    });
  });

  it('should detect a JSON object and tolerate leading whitespace', () => {
    expect(getPastedFile('\n  {"Id":"001"}', ['.json'])?.extension).toEqual('.json');
  });

  it('should detect multi-line CSV', () => {
    expect(getPastedFile('Id,Name\n001,Acme', ['.csv'])).toEqual({
      filename: 'Clipboard-Paste.csv',
      extension: '.csv',
      content: 'Id,Name\n001,Acme',
    });
  });

  it('should not treat a single-line string as CSV', () => {
    expect(getPastedFile('just some text', ['.csv'])).toBeNull();
  });

  it('should not detect JSON when json is not accepted', () => {
    expect(getPastedFile('[{"Id":"001"}]', ['.csv'])).toBeNull();
  });

  it('should fall back to CSV when json is accepted but the content is not json', () => {
    expect(getPastedFile('Id,Name\n001,Acme', ['.csv', '.json'])?.extension).toEqual('.csv');
  });
});
