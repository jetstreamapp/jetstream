import { describe, expect, it } from 'vitest';
import { isLoopbackAddress } from '../network.utils';

describe('isLoopbackAddress', () => {
  it.each(['127.0.0.1', '127.0.0.2', '127.255.255.254', '::1', '::ffff:127.0.0.1'])('accepts the loopback address %s', (address) => {
    expect(isLoopbackAddress(address)).toBe(true);
  });

  it.each(['10.0.0.1', '192.168.1.20', '0.0.0.0', '128.0.0.1', '::2', '::ffff:10.0.0.1', '2001:db8::1'])(
    'rejects the non-loopback address %s',
    (address) => {
      expect(isLoopbackAddress(address)).toBe(false);
    },
  );

  it.each([undefined, null, '', 'localhost', '127.0.0.1:3333', 'not-an-ip'])('rejects %s, which is not an IP address', (address) => {
    expect(isLoopbackAddress(address)).toBe(false);
  });
});
