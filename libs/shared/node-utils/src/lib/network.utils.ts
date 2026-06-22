import type { LookupAddress } from 'dns';
import * as dns from 'dns/promises';
import { LRUCache } from 'lru-cache';
import * as net from 'net';
import type { Agent } from 'undici';

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
 * Strip any protocol or path so we are left with just the hostname.
 */
function extractHostname(hostnameOrUrl: string): string {
  try {
    const url = new URL(hostnameOrUrl.includes('://') ? hostnameOrUrl : `https://${hostnameOrUrl}`);
    return url.hostname;
  } catch {
    // If URL parsing fails, use the raw value
    return hostnameOrUrl;
  }
}

/**
 * Resolves a hostname a SINGLE time and validates that EVERY resolved address
 * is public (not private/reserved). Returns the validated IPs (with their family)
 * so callers can pin a connection to exactly the addresses that were checked,
 * closing the DNS-rebinding TOCTOU window where a second lookup could resolve
 * to an internal host.
 *
 * Raw IP literals are validated directly without a DNS lookup.
 *
 * @throws Error if the domain cannot be resolved or resolves to a private/reserved IP
 */
export async function resolveHostnameToValidatedPublicIps(hostnameOrUrl: string): Promise<LookupAddress[]> {
  const cleanHostname = extractHostname(hostnameOrUrl);

  // A raw IP literal needs no DNS lookup — validate it directly.
  if (net.isIP(cleanHostname)) {
    if (isPrivateOrReservedIp(cleanHostname)) {
      throw new Error(`Hostname resolves to a private or reserved IP address`);
    }
    return [{ address: cleanHostname, family: net.isIPv6(cleanHostname) ? 6 : 4 }];
  }

  const addresses: LookupAddress[] = [];

  try {
    const ipv4Results = await dns.resolve4(cleanHostname);
    addresses.push(...ipv4Results.map((address) => ({ address, family: 4 as const })));
  } catch {
    // Domain may not have A records
  }

  try {
    const ipv6Results = await dns.resolve6(cleanHostname);
    addresses.push(...ipv6Results.map((address) => ({ address, family: 6 as const })));
  } catch {
    // Domain may not have AAAA records
  }

  if (addresses.length === 0) {
    throw new Error(`Unable to resolve DNS for hostname: ${cleanHostname}`);
  }

  for (const { address } of addresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new Error(`Hostname resolves to a private or reserved IP address`);
    }
  }

  return addresses;
}

/**
 * Resolves a hostname to IP addresses and validates that none of them
 * point to private or reserved IP ranges. This prevents SSRF attacks
 * where an attacker-controlled domain resolves to internal infrastructure.
 *
 * NOTE: this only validates — it does NOT pin the connection, so on its own it
 * is vulnerable to DNS rebinding (the subsequent fetch re-resolves DNS). Prefer
 * {@link createPinnedPublicIpDispatcher} for outbound requests so the validated
 * IP is the IP actually connected to. Kept for back-compat / pure validation use.
 *
 * @throws Error if the domain resolves to a private/reserved IP
 */
export async function assertDomainResolvesToPublicIp(hostname: string): Promise<void> {
  await resolveHostnameToValidatedPublicIps(hostname);
}

/**
 * Builds an undici {@link Agent} that pins all outbound connections for the given
 * hostname to a pre-validated public IP, defeating DNS-rebinding TOCTOU attacks.
 *
 * The hostname is resolved and validated ONCE up front. The returned agent installs
 * a custom `connect.lookup` that returns ONLY those pre-validated IPs and re-checks
 * each is public inside the callback, so undici/Node never performs an independent
 * second DNS resolution that could rebind to 169.254.169.254 / internal hosts.
 *
 * The original Host header and TLS SNI (servername) are preserved because undici
 * keys the connection on the original hostname and only the IP that the socket
 * connects to is overridden.
 *
 * Usage: `fetch(url, { dispatcher: await createPinnedPublicIpDispatcher(new URL(url).hostname) })`
 *
 * @throws Error if the hostname cannot be resolved or resolves to a private/reserved IP
 */
/**
 * Pure selection logic for the pinned `connect.lookup`: re-validates every pinned address and
 * narrows to the family the caller requested. Extracted so it can be unit-tested without
 * constructing an undici Agent (which can't load under this lib's jsdom test environment).
 *
 * @param requestedFamily Node passes `0`/undefined for "any" and `4`/`6` (or the `'IPv4'`/`'IPv6'`
 *   string forms) for a specific family.
 * @throws Error if a pinned address is now private/reserved, or none match the requested family.
 */
export function selectPinnedLookupAddresses(
  validatedAddresses: LookupAddress[],
  requestedFamily: number | 'IPv4' | 'IPv6' | undefined,
): LookupAddress[] {
  // Re-validate at connect time so a rebind cannot slip through even if the pinned
  // list were ever tampered with; the addresses came from our single validated lookup.
  for (const { address } of validatedAddresses) {
    if (isPrivateOrReservedIp(address)) {
      throw new Error('Hostname resolves to a private or reserved IP address');
    }
  }

  // Honor an explicit IPv4-only / IPv6-only request; `0`/undefined means "any family".
  const family =
    requestedFamily === 4 || requestedFamily === 'IPv4' ? 4 : requestedFamily === 6 || requestedFamily === 'IPv6' ? 6 : undefined;
  const matchingAddresses = family ? validatedAddresses.filter((address) => address.family === family) : validatedAddresses;

  if (matchingAddresses.length === 0) {
    throw new Error(`No validated public IPv${family} address is available for the host`);
  }
  return matchingAddresses;
}

export async function createPinnedPublicIpDispatcher(hostname: string): Promise<Agent> {
  const validatedAddresses = await resolveHostnameToValidatedPublicIps(hostname);

  // Node's `lookup` option signature: (hostname, options, callback). When `options.all`
  // is set the callback expects an array of LookupAddress, otherwise (address, family).
  const pinnedLookup: net.LookupFunction = (_lookupHostname, options, callback) => {
    let matchingAddresses: LookupAddress[];
    try {
      matchingAddresses = selectPinnedLookupAddresses(validatedAddresses, options.family);
    } catch (error) {
      // Pass an empty LookupAddress[] (ignored by undici on the error path) so the shape is valid
      // for both the `all` and single-address callback overloads.
      callback(error as NodeJS.ErrnoException, []);
      return;
    }

    if (options.all) {
      callback(null, matchingAddresses);
      return;
    }

    const [first] = matchingAddresses;
    callback(null, first.address, first.family);
  };

  // undici is imported lazily so this Node-only dependency is not pulled into the module graph
  // when only the pure validation helpers are used (e.g. in jsdom-based unit tests).
  const { Agent } = await import('undici');
  return new Agent({
    connect: {
      lookup: pinnedLookup,
      // Hosts like Okta return MULTIPLE A records. Without Happy-Eyeballs, undici asks the pinned
      // lookup for a single address and connects to only the first one — with no fallback — so a
      // single unhealthy/unroutable IP in the set breaks every request even though a sibling IP is
      // reachable (the exact failure stock `fetch` avoids, since Node enables this by default).
      // autoSelectFamily makes undici request the full validated list (`all: true`) and attempt each
      // address in turn, restoring that resilience while still only ever connecting to our validated IPs.
      autoSelectFamily: true,
    },
  });
}

/**
 * Reuse pinned dispatchers per host instead of creating (and leaking) a fresh undici `Agent` for
 * every outbound request. Each `Agent` owns a connection pool, so a new one per request would
 * accumulate sockets/FDs under load. The cached promise also collapses concurrent first requests
 * to the same host onto a single DNS validation + Agent. The TTL keeps the pinned IP fresh
 * (re-validated when the entry expires) while still amortizing the Agent across a burst of requests.
 *
 * `dispose` fires on eviction/expiry/overwrite and closes the pool to release its sockets, so
 * callers never have to manage the Agent lifecycle (important when the `Response` body outlives the
 * function that issued the fetch, e.g. SAML metadata fetching).
 */
const pinnedDispatcherCache = new LRUCache<string, Promise<Agent>>({
  max: 100,
  ttl: 1000 * 60,
  dispose: (dispatcherPromise) => {
    dispatcherPromise.then((dispatcher) => dispatcher.close()).catch(() => undefined);
  },
});

/**
 * Cached, auto-closing variant of {@link createPinnedPublicIpDispatcher}. Prefer this for outbound
 * requests so connection pools are reused per host and closed on eviction/expiry rather than leaked.
 *
 * @throws Error if the hostname cannot be resolved or resolves to a private/reserved IP
 */
export function getPinnedPublicIpDispatcher(hostname: string): Promise<Agent> {
  const cached = pinnedDispatcherCache.get(hostname);
  if (cached) {
    return cached;
  }
  // If validation rejects, evict so a later request retries rather than caching a rejected promise.
  const dispatcherPromise = createPinnedPublicIpDispatcher(hostname).catch((error) => {
    pinnedDispatcherCache.delete(hostname);
    throw error;
  });
  pinnedDispatcherCache.set(hostname, dispatcherPromise);
  return dispatcherPromise;
}
