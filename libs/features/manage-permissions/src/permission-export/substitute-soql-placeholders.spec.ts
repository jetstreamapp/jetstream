import { describe, expect, it } from 'vitest';
import { substituteSoqlPlaceholders } from './substitute-soql-placeholders';

describe('substituteSoqlPlaceholders', () => {
  it('replaces simple tokens', () => {
    const soql = 'SELECT Id FROM PermissionSet WHERE Name IN ({{ permissionSetNames }})';
    const out = substituteSoqlPlaceholders(soql, { permissionSetNames: "'Foo','Bar'" });
    expect(out).toBe("SELECT Id FROM PermissionSet WHERE Name IN ('Foo','Bar')");
  });
});
