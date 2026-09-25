import { describe, expect, it } from 'vitest';
import { getPreferencesToRestore } from '../settings-save.utils';

describe('getPreferencesToRestore', () => {
  it('restores the last saved value of a setting that still holds the failed value', () => {
    expect(getPreferencesToRestore({ darkMode: true, sync: true }, { darkMode: true }, { darkMode: false })).toEqual({ darkMode: false });
  });

  it('keeps a setting that was changed again after the failed save', () => {
    expect(getPreferencesToRestore({ indent: 3 }, { indent: 2 }, { indent: 1 })).toEqual({});
  });

  it('compares object values by content', () => {
    expect(getPreferencesToRestore({ format: { indent: 2 } }, { format: { indent: 2 } }, { format: { indent: 1 } })).toEqual({
      format: { indent: 1 },
    });
  });

  it('restores a setting whose last saved value was unset', () => {
    expect(getPreferencesToRestore<{ path?: string }>({ path: '/tmp' }, { path: '/tmp' }, {})).toEqual({ path: undefined });
  });
});
