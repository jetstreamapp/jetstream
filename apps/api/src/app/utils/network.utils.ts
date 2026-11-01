import { Maybe } from '@jetstream/types';
import net from 'node:net';

// 127.0.0.0/8 covers every IPv4 loopback address, and BlockList also matches the IPv4-mapped IPv6 form
// (::ffff:127.0.0.1) that Node reports when a dual-stack listener accepts an IPv4 connection.
const loopbackAddresses = new net.BlockList();
loopbackAddresses.addSubnet('127.0.0.0', 8, 'ipv4');
loopbackAddresses.addAddress('::1', 'ipv6');

/**
 * Whether a TCP peer address (e.g. `req.socket.remoteAddress`) is the local machine.
 *
 * Unlike `req.hostname` or `req.ip`, the socket's remote address is not derived from any request header, so a client
 * cannot spoof it through `Host` / `X-Forwarded-*` even when the app trusts a proxy.
 */
export function isLoopbackAddress(address: Maybe<string>): boolean {
  if (!address) {
    return false;
  }
  const ipVersion = net.isIP(address);
  if (ipVersion === 4) {
    return loopbackAddresses.check(address, 'ipv4');
  }
  if (ipVersion === 6) {
    return loopbackAddresses.check(address, 'ipv6');
  }
  return false;
}
