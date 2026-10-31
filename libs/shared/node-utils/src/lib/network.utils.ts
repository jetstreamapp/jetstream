import type { LookupAddress } from 'dns';
import * as dns from 'dns/promises';
import { LRUCache } from 'lru-cache';
import * as net from 'net';
import type { Agent } from 'undici';

/**
 * Address ranges that server-side requests must never reach: loopback, link-local, RFC 1918 private
 * ranges, carrier-grade NAT, documentation/benchmarking ranges, multicast and reserved space, cloud
 * metadata IPs, and their IPv6 equivalents.
 *
 * Built on `net.BlockList` so matching is done on the parsed address rather than its textual form:
 * `::ffff:7f00:1`, `::ffff:127.0.0.1` and the fully expanded spelling are all the same mapped loopback
 * address, and a `/10` such as `fe80::/10` also covers `fe90…`–`febf…`. `check(address, 'ipv6')`
 * matches IPv4-mapped IPv6 addresses against the IPv4 rules, so the `::ffff:0:0/96` mapped range needs
 * no entry of its own.
 */
const BLOCKED_ADDRESSES = new net.BlockList();

BLOCKED_ADDRESSES.addSubnet('0.0.0.0', 8, 'ipv4'); // 0.0.0.0/8 — current network
BLOCKED_ADDRESSES.addSubnet('10.0.0.0', 8, 'ipv4'); // 10.0.0.0/8
BLOCKED_ADDRESSES.addSubnet('127.0.0.0', 8, 'ipv4'); // 127.0.0.0/8 — loopback
BLOCKED_ADDRESSES.addSubnet('169.254.0.0', 16, 'ipv4'); // 169.254.0.0/16 — link-local / cloud metadata (169.254.169.254)
BLOCKED_ADDRESSES.addSubnet('172.16.0.0', 12, 'ipv4'); // 172.16.0.0/12
BLOCKED_ADDRESSES.addSubnet('192.168.0.0', 16, 'ipv4'); // 192.168.0.0/16
BLOCKED_ADDRESSES.addSubnet('100.64.0.0', 10, 'ipv4'); // 100.64.0.0/10 — carrier-grade NAT
BLOCKED_ADDRESSES.addSubnet('192.0.0.0', 24, 'ipv4'); // 192.0.0.0/24 — IETF protocol assignments
BLOCKED_ADDRESSES.addSubnet('192.0.2.0', 24, 'ipv4'); // 192.0.2.0/24 — TEST-NET-1
BLOCKED_ADDRESSES.addSubnet('198.51.100.0', 24, 'ipv4'); // 198.51.100.0/24 — TEST-NET-2
BLOCKED_ADDRESSES.addSubnet('203.0.113.0', 24, 'ipv4'); // 203.0.113.0/24 — TEST-NET-3
BLOCKED_ADDRESSES.addSubnet('198.18.0.0', 15, 'ipv4'); // 198.18.0.0/15 — benchmarking
BLOCKED_ADDRESSES.addSubnet('224.0.0.0', 4, 'ipv4'); // 224.0.0.0/4 — multicast
BLOCKED_ADDRESSES.addSubnet('240.0.0.0', 4, 'ipv4'); // 240.0.0.0/4 — reserved, includes the limited broadcast address

BLOCKED_ADDRESSES.addAddress('::', 'ipv6'); // ::/128 — unspecified
BLOCKED_ADDRESSES.addAddress('::1', 'ipv6'); // ::1/128 — loopback
BLOCKED_ADDRESSES.addSubnet('::', 96, 'ipv6'); // ::/96 — deprecated IPv4-compatible form, embeds an IPv4 address (::7f00:1)
BLOCKED_ADDRESSES.addSubnet('fe80::', 10, 'ipv6'); // fe80::/10 — link-local
BLOCKED_ADDRESSES.addSubnet('fc00::', 7, 'ipv6'); // fc00::/7 — unique local
BLOCKED_ADDRESSES.addSubnet('ff00::', 8, 'ipv6'); // ff00::/8 — multicast
BLOCKED_ADDRESSES.addSubnet('64:ff9b::', 96, 'ipv6'); // 64:ff9b::/96 — NAT64 well-known prefix, embeds an IPv4 address
BLOCKED_ADDRESSES.addSubnet('64:ff9b:1::', 48, 'ipv6'); // 64:ff9b:1::/48 — NAT64 local-use prefix
BLOCKED_ADDRESSES.addSubnet('2001:db8::', 32, 'ipv6'); // 2001:db8::/32 — documentation
BLOCKED_ADDRESSES.addSubnet('2002::', 16, 'ipv6'); // 2002::/16 — 6to4, the embedded IPv4 address can be private
BLOCKED_ADDRESSES.addSubnet('100::', 64, 'ipv6'); // 100::/64 — discard-only

/**
 * Checks whether an IP address belongs to a private, reserved, or otherwise non-public range that
 * should not be reached by server-side requests. See {@link BLOCKED_ADDRESSES} for the ranges.
 *
 * Pure (no DNS) so it can run anywhere, including the pinned dispatcher's `connect.lookup` callback.
 */
function isPrivateOrReservedIp(ip: string): boolean {
  const family = net.isIP(ip);
  if (family === 4) {
    return BLOCKED_ADDRESSES.check(ip, 'ipv4');
  }
  if (family === 6) {
    return BLOCKED_ADDRESSES.check(ip, 'ipv6');
  }
  // Not a parseable address of either family — reject rather than let an unknown form through
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
    },
  });
}

/**
 * Fetch `url` with the connection pinned to a validated public IP (SSRF-safe), using undici's OWN
 * `fetch` rather than Node's global `fetch`.
 *
 * IMPORTANT — always use this (never the global `fetch`) when pinning: {@link getPinnedPublicIpDispatcher}
 * returns an undici `Agent` from THIS package, but Node's global `fetch` is a *separate* undici instance
 * bundled with the runtime. Handing a foreign dispatcher to the global fetch makes undici reject the
 * request at construction with `InvalidArgumentError: invalid onRequestStart method` — the two instances'
 * internal request-handler interfaces don't match. Pairing this package's `fetch` with this package's
 * `Agent` keeps them on the same instance. Callers (and oauth4webapi) only use the standard `Response`
 * surface, which undici's `Response` implements.
 *
 * @throws Error if the hostname cannot be resolved or resolves to a private/reserved IP
 */
export async function fetchWithPinnedPublicIp(url: string | URL, init?: RequestInit): Promise<Response> {
  // Lazy import keeps the Node-only undici dependency out of the jsdom unit-test module graph.
  const { fetch: undiciFetch } = await import('undici');
  const dispatcher = await getPinnedPublicIpDispatcher(new URL(url).hostname);
  const response = await undiciFetch(url, { ...init, dispatcher } as Parameters<typeof undiciFetch>[1]);
  return response as unknown as Response;
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
