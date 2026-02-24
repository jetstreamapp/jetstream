import * as dns from 'dns/promises';
import * as net from 'net';

/**
 * Checks whether an IP address belongs to a private, reserved, or otherwise
 * non-public range that should not be reached by server-side requests.
 *
 * Covers: loopback, link-local, RFC 1918 private ranges, carrier-grade NAT,
 * documentation ranges, benchmarking, IPv6 equivalents, and cloud metadata IPs.
 */
function isPrivateOrReservedIp(ip: string): boolean {
  // IPv4-mapped IPv6 (e.g., ::ffff:127.0.0.1) — extract the IPv4 portion
  const v4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const normalizedIp = v4Mapped ? v4Mapped[1] : ip;

  if (net.isIPv4(normalizedIp)) {
    const parts = normalizedIp.split('.').map(Number);
    const [a, b] = parts;
    return (
      a === 0 || // 0.0.0.0/8 — current network
      a === 10 || // 10.0.0.0/8
      a === 127 || // 127.0.0.0/8 — loopback
      (a === 169 && b === 254) || // 169.254.0.0/16 — link-local / cloud metadata (169.254.169.254)
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) || // 192.168.0.0/16
      (a === 100 && b >= 64 && b <= 127) || // 100.64.0.0/10 — carrier-grade NAT
      (a === 192 && b === 0 && parts[2] === 0) || // 192.0.0.0/24 — IETF protocol assignments
      (a === 192 && b === 0 && parts[2] === 2) || // 192.0.2.0/24 — TEST-NET-1
      (a === 198 && b === 51 && parts[2] === 100) || // 198.51.100.0/24 — TEST-NET-2
      (a === 203 && b === 0 && parts[2] === 113) || // 203.0.113.0/24 — TEST-NET-3
      (a === 198 && b >= 18 && b <= 19) || // 198.18.0.0/15 — benchmarking
      a >= 224 // 224.0.0.0+ — multicast & reserved
    );
  }

  if (net.isIPv6(normalizedIp)) {
    const lower = normalizedIp.toLowerCase();
    return (
      lower === '::' || // unspecified
      lower === '::1' || // loopback
      lower.startsWith('fe80') || // link-local
      lower.startsWith('fc') || // unique local (fc00::/7)
      lower.startsWith('fd') || // unique local (fc00::/7)
      lower.startsWith('ff') // multicast
    );
  }

  // If we can't determine the type, reject it to be safe
  return true;
}

/**
 * Resolves a hostname to IP addresses and validates that none of them
 * point to private or reserved IP ranges. This prevents SSRF attacks
 * where an attacker-controlled domain resolves to internal infrastructure.
 *
 * @throws Error if the domain resolves to a private/reserved IP
 */
export async function assertDomainResolvesToPublicIp(hostname: string): Promise<void> {
  // Strip any protocol or path — we only want the hostname
  let cleanHostname = hostname;
  try {
    const url = new URL(hostname.includes('://') ? hostname : `https://${hostname}`);
    cleanHostname = url.hostname;
  } catch {
    // If URL parsing fails, use the raw value
  }

  // Reject if the hostname is already a raw IP literal
  if (net.isIP(cleanHostname)) {
    if (isPrivateOrReservedIp(cleanHostname)) {
      throw new Error(`Hostname resolves to a private or reserved IP address`);
    }
    return;
  }

  const addresses: string[] = [];

  try {
    const ipv4Results = await dns.resolve4(cleanHostname);
    addresses.push(...ipv4Results);
  } catch {
    // Domain may not have A records
  }

  try {
    const ipv6Results = await dns.resolve6(cleanHostname);
    addresses.push(...ipv6Results);
  } catch {
    // Domain may not have AAAA records
  }

  if (addresses.length === 0) {
    throw new Error(`Unable to resolve DNS for hostname: ${cleanHostname}`);
  }

  for (const ip of addresses) {
    if (isPrivateOrReservedIp(ip)) {
      throw new Error(`Hostname resolves to a private or reserved IP address`);
    }
  }
}
