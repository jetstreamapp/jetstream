import { PermissionSetRecord } from '@jetstream/types';
import { getProfileAndPermissionSetListItems } from '../hooks/useProfilesAndPermSets';

function permissionSet(overrides: Partial<PermissionSetRecord>): PermissionSetRecord {
  return {
    attributes: { type: 'PermissionSet', url: '' },
    Id: '0PS000000000001',
    Name: 'Test',
    Label: 'Test',
    Type: 'Regular',
    IsCustom: true,
    IsOwnedByProfile: false,
    NamespacePrefix: null,
    ProfileId: null,
    ...overrides,
  };
}

function profilePermissionSet(id: string, profileName: string | null): PermissionSetRecord {
  return permissionSet({
    Id: id,
    Name: `X00e${id}`,
    Label: `00e${id}`,
    Type: 'Profile',
    IsOwnedByProfile: true,
    ProfileId: `00e${id}`,
    Profile: profileName ? { Id: `00e${id}`, Name: profileName, UserType: 'Standard' } : null,
  } as Partial<PermissionSetRecord>);
}

describe('getProfileAndPermissionSetListItems', () => {
  it('labels profiles with the profile name', () => {
    const output = getProfileAndPermissionSetListItems([profilePermissionSet('1', 'System Administrator')], null);
    expect(output.profiles.map(({ label }) => label)).toEqual(['System Administrator']);
    expect(output.hiddenProfileCount).toBe(0);
  });

  it('omits and counts profiles hidden by profile filtering', () => {
    const output = getProfileAndPermissionSetListItems(
      [profilePermissionSet('1', 'Standard Platform User'), profilePermissionSet('2', null), profilePermissionSet('3', null)],
      null,
    );
    expect(output.profiles.map(({ label }) => label)).toEqual(['Standard Platform User']);
    expect(output.hiddenProfileCount).toBe(2);
  });

  it('keeps permission sets regardless of hidden profiles', () => {
    const output = getProfileAndPermissionSetListItems(
      [profilePermissionSet('1', null), permissionSet({ Id: '0PS2', Label: 'Sales' })],
      null,
    );
    expect(output.permissionSets.map(({ label }) => label)).toEqual(['Sales']);
    expect(output.hiddenProfileCount).toBe(1);
  });
});
