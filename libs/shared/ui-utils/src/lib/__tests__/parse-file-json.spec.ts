import { parseJson } from '../parse-json';
import { parseFile } from '../shared-ui-utils';

describe('parseJson', () => {
  it('should parse a top-level array of records', () => {
    const result = parseJson(JSON.stringify([{ Id: '001', Name: 'Acme' }]));
    expect(result.data).toEqual([{ Id: '001', Name: 'Acme' }]);
    expect(result.headers).toEqual(['Id', 'Name']);
    expect(result.errors).toEqual([]);
  });

  it('should unwrap a records wrapper', () => {
    const result = parseJson(JSON.stringify({ totalSize: 1, done: true, records: [{ Id: '001', Name: 'Acme' }] }));
    expect(result.data).toEqual([{ Id: '001', Name: 'Acme' }]);
    expect(result.headers).toEqual(['Id', 'Name']);
  });

  it('should treat a single object as one record', () => {
    const result = parseJson(JSON.stringify({ Id: '001', Name: 'Acme' }));
    expect(result.data).toEqual([{ Id: '001', Name: 'Acme' }]);
  });

  it('should return no data for an empty array', () => {
    const result = parseJson('[]');
    expect(result.data).toEqual([]);
    expect(result.headers).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it('should strip the Salesforce attributes envelope', () => {
    const result = parseJson(
      JSON.stringify([{ attributes: { type: 'Account', url: '/services/data/v64.0/sobjects/Account/001' }, Id: '001' }]),
    );
    expect(result.data).toEqual([{ Id: '001' }]);
    expect(result.headers).toEqual(['Id']);
  });

  it('should keep an attributes key that is not a Salesforce envelope', () => {
    const result = parseJson(JSON.stringify([{ Id: '001', attributes: { color: 'red' } }]));
    expect(result.data).toEqual([{ Id: '001', 'attributes.color': 'red' }]);
    expect(result.headers).toEqual(['Id', 'attributes.color']);
  });

  it('should keep an attributes key that has a type but extra keys beyond the envelope', () => {
    const result = parseJson(JSON.stringify([{ Id: '001', attributes: { type: 'premium', tier: 'gold' } }]));
    expect(result.data).toEqual([{ Id: '001', 'attributes.type': 'premium', 'attributes.tier': 'gold' }]);
  });

  it('should strip an AggregateResult envelope, which has no url', () => {
    const result = parseJson(JSON.stringify([{ attributes: { type: 'AggregateResult' }, expr0: 5 }]));
    expect(result.data).toEqual([{ expr0: 5 }]);
    expect(result.headers).toEqual(['expr0']);
  });

  it('should drop the bare parent header left behind by an empty lookup', () => {
    const result = parseJson(
      JSON.stringify([
        { Id: '1', Parent: null },
        { Id: '2', Parent: { Name: 'Acme' } },
      ]),
    );
    expect(result.headers).toEqual(['Id', 'Parent.Name']);
    expect(result.data).toEqual([{ Id: '1' }, { Id: '2', 'Parent.Name': 'Acme' }]);
  });

  it('should drop bare parent headers at every nesting level', () => {
    const result = parseJson(JSON.stringify([{ Owner: null }, { Owner: { Profile: null } }, { Owner: { Profile: { Name: 'Admin' } } }]));
    expect(result.headers).toEqual(['Owner.Profile.Name']);
  });

  it('should keep a bare parent header when some row holds a real value there', () => {
    const result = parseJson(JSON.stringify([{ Parent: 'a005' }, { Parent: { Name: 'Acme' } }]));
    expect(result.headers).toEqual(['Parent', 'Parent.Name']);
    expect(result.data).toEqual([{ Parent: 'a005' }, { 'Parent.Name': 'Acme' }]);
  });

  it('should flatten nested relationship records to dot-notation and strip their attributes', () => {
    const result = parseJson(
      JSON.stringify([
        {
          Id: '001',
          Owner: { attributes: { type: 'User', url: '/services/data/v64.0/sobjects/User/005' }, Name: 'Bob', Profile: { Name: 'Admin' } },
        },
      ]),
    );
    expect(result.data).toEqual([{ Id: '001', 'Owner.Name': 'Bob', 'Owner.Profile.Name': 'Admin' }]);
    expect(result.headers).toEqual(['Id', 'Owner.Name', 'Owner.Profile.Name']);
  });

  it('should serialize subquery records', () => {
    const contacts = [{ Id: '003a' }, { Id: '003b' }];
    const result = parseJson(JSON.stringify([{ Id: '001', Contacts: { totalSize: 2, done: true, records: contacts } }]));
    expect(result.data).toEqual([{ Id: '001', Contacts: JSON.stringify(contacts) }]);
  });

  it('should serialize array values', () => {
    const result = parseJson(JSON.stringify([{ Id: '001', Tags: ['a', 'b'] }]));
    expect(result.data).toEqual([{ Id: '001', Tags: '["a","b"]' }]);
  });

  it('should build headers from every record, not just the first', () => {
    const result = parseJson(JSON.stringify([{ Id: '001' }, { Name: 'Acme', Id: '002' }, { Website: 'example.com' }]));
    expect(result.headers).toEqual(['Id', 'Name', 'Website']);
  });

  it('should preserve value types', () => {
    const result = parseJson(JSON.stringify([{ Name: 'Acme', Amount: 12.5, IsActive: false, Description: null }]));
    expect(result.data).toEqual([{ Name: 'Acme', Amount: 12.5, IsActive: false, Description: null }]);
  });

  it('should skip entries that are not records and report them', () => {
    const result = parseJson(JSON.stringify([{ Id: '001' }, 'nope', 42, null]));
    expect(result.data).toEqual([{ Id: '001' }]);
    expect(result.errors).toEqual(['3 items were skipped because they are not records.']);
  });

  it('should serialize objects nested beyond the max flatten depth', () => {
    // 12 levels deep, which is past the depth limit of 10
    let deeplyNested: Record<string, unknown> = { value: 'found' };
    for (let i = 0; i < 12; i++) {
      deeplyNested = { nested: deeplyNested };
    }
    const result = parseJson(JSON.stringify([deeplyNested]));
    expect(result.headers).toHaveLength(1);
    expect(result.headers[0].split('.')).toHaveLength(11);
    expect(result.data[0][result.headers[0]]).toEqual(JSON.stringify({ nested: { value: 'found' } }));
  });

  it('should throw for invalid JSON', () => {
    expect(() => parseJson('{ not json')).toThrow(/not valid JSON/);
  });

  it('should throw when the content is not a record or array of records', () => {
    expect(() => parseJson('"just a string"')).toThrow(/must contain a record/);
    expect(() => parseJson('null')).toThrow(/must contain a record/);
  });
});

describe('parseFile with JSON', () => {
  it('should parse JSON when the extension is json', async () => {
    const result = await parseFile(JSON.stringify([{ Id: '001', Name: 'Acme' }]), { extension: '.json' });
    expect(result.data).toEqual([{ Id: '001', Name: 'Acme' }]);
    expect(result.headers).toEqual(['Id', 'Name']);
  });

  it('should parse JSON provided as an ArrayBuffer', async () => {
    const content = new TextEncoder().encode(JSON.stringify([{ Id: '001', Name: 'Acme' }]));
    const result = await parseFile(content.buffer as ArrayBuffer, { extension: '.json' });
    expect(result.data).toEqual([{ Id: '001', Name: 'Acme' }]);
    expect(result.headers).toEqual(['Id', 'Name']);
  });

  it('should still parse csv content as csv', async () => {
    const result = await parseFile('Id,Name\n001,Acme', { extension: '.csv' });
    expect(result.data).toEqual([{ Id: '001', Name: 'Acme' }]);
  });
});
