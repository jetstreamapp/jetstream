// @vitest-environment node
/**
 * The managed package maps Jetstream's tool and operation keys to Salesforce custom permissions in Apex. Access
 * profiles are allow-lists, so a key missing from that map silently withholds the tool from every Limited Access
 * user and a misspelled key is dropped by the canvas app. These checks keep the Apex maps in step with the catalog.
 */
import { ACCESS_PROFILE_OPERATION_KEYS, ACCESS_PROFILE_TOOL_KEYS } from '@jetstream/types';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PACKAGE_ROOT = new URL('../../../../../apps-sfdx/canvas-app/jetstream/main/default/', import.meta.url);
const CONTROLLER_SOURCE = readFileSync(new URL('classes/JetstreamPageController.cls', PACKAGE_ROOT), 'utf8');

/** Canvas only works with the org that opened it, so connecting orgs has no custom permission */
const OPERATIONS_WITHOUT_PERMISSION = ['orgs.connect'];

function parseApexStringMap(mapName: string): Map<string, string> {
  const mapBody = CONTROLLER_SOURCE.match(new RegExp(`${mapName}\\s*=\\s*new Map<String, String>\\{([^}]*)\\}`))?.[1];
  if (!mapBody) {
    throw new Error(`Could not find ${mapName} in JetstreamPageController.cls`);
  }
  return new Map(Array.from(mapBody.matchAll(/'([^']+)'\s*=>\s*'([^']+)'/g), ([, key, permission]) => [key, permission]));
}

function customPermissionExists(permission: string) {
  return existsSync(fileURLToPath(new URL(`customPermissions/${permission}.customPermission-meta.xml`, PACKAGE_ROOT)));
}

describe('canvas custom permissions', () => {
  const toolPermissions = parseApexStringMap('TOOL_PERMISSIONS');
  const operationPermissions = parseApexStringMap('OPERATION_PERMISSIONS');

  it('maps every tool key, and only tool keys', () => {
    expect([...toolPermissions.keys()].sort()).toEqual([...ACCESS_PROFILE_TOOL_KEYS].sort());
  });

  it('maps every operation key that applies to canvas, and only those', () => {
    const expectedOperations = ACCESS_PROFILE_OPERATION_KEYS.filter((key) => !OPERATIONS_WITHOUT_PERMISSION.includes(key));
    expect([...operationPermissions.keys()].sort()).toEqual([...expectedOperations].sort());
  });

  it('ships a custom permission for every mapped permission name', () => {
    const missingPermissions = [...toolPermissions.values(), ...operationPermissions.values(), 'Limited_Access'].filter(
      (permission) => !customPermissionExists(permission),
    );
    expect(missingPermissions).toEqual([]);
  });
});
