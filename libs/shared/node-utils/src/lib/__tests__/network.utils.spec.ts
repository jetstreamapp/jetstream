import type { LookupAddress } from 'dns';
import * as dns from 'dns/promises';
import { assertDomainResolvesToPublicIp, resolveHostnameToValidatedPublicIps, selectPinnedLookupAddresses } from '../network.utils';

// jsdom-environment tests can't auto-mock `dns/promises`, so stub the two functions we use.
vi.mock('dns/promises', () => ({
  resolve4: vi.fn(),
  resolve6: vi.fn(),
}));

const mockedDns = vi.mocked(dns);

describe('assertDomainResolvesToPublicIp', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should allow a domain that resolves to a public IP', async () => {
    mockedDns.resolve4.mockResolvedValue(['93.184.216.34']);
    mockedDns.resolve6.mockRejectedValue(new Error('no AAAA'));

    await expect(assertDomainResolvesToPublicIp('example.com')).resolves.toBeUndefined();
  });

  it('should reject a domain that resolves to 127.0.0.1 (loopback)', async () => {
    mockedDns.resolve4.mockResolvedValue(['127.0.0.1']);
    mockedDns.resolve6.mockRejectedValue(new Error('no AAAA'));

    await expect(assertDomainResolvesToPublicIp('evil.com')).rejects.toThrow('private or reserved');
  });

  it('should reject a domain that resolves to 10.x.x.x (RFC 1918)', async () => {
    mockedDns.resolve4.mockResolvedValue(['10.0.0.1']);
    mockedDns.resolve6.mockRejectedValue(new Error('no AAAA'));

    await expect(assertDomainResolvesToPublicIp('evil.com')).rejects.toThrow('private or reserved');
  });

  it('should reject a domain that resolves to 172.16.x.x (RFC 1918)', async () => {
    mockedDns.resolve4.mockResolvedValue(['172.16.0.1']);
    mockedDns.resolve6.mockRejectedValue(new Error('no AAAA'));

    await expect(assertDomainResolvesToPublicIp('evil.com')).rejects.toThrow('private or reserved');
  });

  it('should reject a domain that resolves to 192.168.x.x (RFC 1918)', async () => {
    mockedDns.resolve4.mockResolvedValue(['192.168.1.1']);
    mockedDns.resolve6.mockRejectedValue(new Error('no AAAA'));

    await expect(assertDomainResolvesToPublicIp('evil.com')).rejects.toThrow('private or reserved');
  });

  it('should reject a domain that resolves to 169.254.x.x (link-local / cloud metadata)', async () => {
    mockedDns.resolve4.mockResolvedValue(['169.254.169.254']);
    mockedDns.resolve6.mockRejectedValue(new Error('no AAAA'));

    await expect(assertDomainResolvesToPublicIp('evil.com')).rejects.toThrow('private or reserved');
  });

  it('should reject a domain that resolves to 100.64.x.x (carrier-grade NAT)', async () => {
    mockedDns.resolve4.mockResolvedValue(['100.64.0.1']);
    mockedDns.resolve6.mockRejectedValue(new Error('no AAAA'));

    await expect(assertDomainResolvesToPublicIp('evil.com')).rejects.toThrow('private or reserved');
  });

  it('should reject a domain that resolves to 0.0.0.0', async () => {
    mockedDns.resolve4.mockResolvedValue(['0.0.0.0']);
    mockedDns.resolve6.mockRejectedValue(new Error('no AAAA'));

    await expect(assertDomainResolvesToPublicIp('evil.com')).rejects.toThrow('private or reserved');
  });

  it('should reject when one of multiple IPs is private', async () => {
    mockedDns.resolve4.mockResolvedValue(['93.184.216.34', '10.0.0.1']);
    mockedDns.resolve6.mockRejectedValue(new Error('no AAAA'));

    await expect(assertDomainResolvesToPublicIp('evil.com')).rejects.toThrow('private or reserved');
  });

  it('should reject IPv6 loopback (::1)', async () => {
    mockedDns.resolve4.mockRejectedValue(new Error('no A'));
    mockedDns.resolve6.mockResolvedValue(['::1']);

    await expect(assertDomainResolvesToPublicIp('evil.com')).rejects.toThrow('private or reserved');
  });

  it('should reject IPv6 link-local (fe80::)', async () => {
    mockedDns.resolve4.mockRejectedValue(new Error('no A'));
    mockedDns.resolve6.mockResolvedValue(['fe80::1']);

    await expect(assertDomainResolvesToPublicIp('evil.com')).rejects.toThrow('private or reserved');
  });

  it('should reject IPv6 unique local (fd00::)', async () => {
    mockedDns.resolve4.mockRejectedValue(new Error('no A'));
    mockedDns.resolve6.mockResolvedValue(['fd00::1']);

    await expect(assertDomainResolvesToPublicIp('evil.com')).rejects.toThrow('private or reserved');
  });

  it('should throw when DNS resolution fails entirely', async () => {
    mockedDns.resolve4.mockRejectedValue(new Error('NXDOMAIN'));
    mockedDns.resolve6.mockRejectedValue(new Error('NXDOMAIN'));

    await expect(assertDomainResolvesToPublicIp('nonexistent.invalid')).rejects.toThrow('Unable to resolve DNS');
  });

  it('should handle a raw IP literal that is private', async () => {
    await expect(assertDomainResolvesToPublicIp('127.0.0.1')).rejects.toThrow('private or reserved');
    expect(mockedDns.resolve4).not.toHaveBeenCalled();
  });

  it('should handle a raw IP literal that is public', async () => {
    await expect(assertDomainResolvesToPublicIp('8.8.8.8')).resolves.toBeUndefined();
    expect(mockedDns.resolve4).not.toHaveBeenCalled();
  });

  it('should handle a URL with protocol prefix', async () => {
    mockedDns.resolve4.mockResolvedValue(['93.184.216.34']);
    mockedDns.resolve6.mockRejectedValue(new Error('no AAAA'));

    await expect(assertDomainResolvesToPublicIp('https://example.com/path')).resolves.toBeUndefined();
    expect(mockedDns.resolve4).toHaveBeenCalledWith('example.com');
  });

  it('should allow a domain with only IPv6 public addresses', async () => {
    mockedDns.resolve4.mockRejectedValue(new Error('no A'));
    mockedDns.resolve6.mockResolvedValue(['2606:4700:4700::1111']);

    await expect(assertDomainResolvesToPublicIp('example.com')).resolves.toBeUndefined();
  });
});

describe('resolveHostnameToValidatedPublicIps', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns validated IPv4 and IPv6 addresses with their family', async () => {
    mockedDns.resolve4.mockResolvedValue(['93.184.216.34']);
    mockedDns.resolve6.mockResolvedValue(['2606:4700:4700::1111']);

    const addresses = await resolveHostnameToValidatedPublicIps('example.com');
    expect(addresses).toEqual([
      { address: '93.184.216.34', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 },
    ]);
  });

  it('returns a raw public IP literal without a DNS lookup', async () => {
    const addresses = await resolveHostnameToValidatedPublicIps('8.8.8.8');
    expect(addresses).toEqual([{ address: '8.8.8.8', family: 4 }]);
    expect(mockedDns.resolve4).not.toHaveBeenCalled();
  });

  it('rejects when any resolved address is private', async () => {
    mockedDns.resolve4.mockResolvedValue(['93.184.216.34', '169.254.169.254']);
    mockedDns.resolve6.mockRejectedValue(new Error('no AAAA'));

    await expect(resolveHostnameToValidatedPublicIps('evil.com')).rejects.toThrow('private or reserved');
  });

  it('throws when the domain cannot be resolved', async () => {
    mockedDns.resolve4.mockRejectedValue(new Error('NXDOMAIN'));
    mockedDns.resolve6.mockRejectedValue(new Error('NXDOMAIN'));

    await expect(resolveHostnameToValidatedPublicIps('nonexistent.invalid')).rejects.toThrow('Unable to resolve DNS');
  });
});

describe('selectPinnedLookupAddresses', () => {
  const ipv4: LookupAddress = { address: '93.184.216.34', family: 4 };
  const ipv6: LookupAddress = { address: '2606:4700:4700::1111', family: 6 };

  it('returns all validated addresses when no specific family is requested', () => {
    expect(selectPinnedLookupAddresses([ipv4, ipv6], undefined)).toEqual([ipv4, ipv6]);
    expect(selectPinnedLookupAddresses([ipv4, ipv6], 0)).toEqual([ipv4, ipv6]);
  });

  it('narrows to the requested IPv4 family', () => {
    expect(selectPinnedLookupAddresses([ipv4, ipv6], 4)).toEqual([ipv4]);
  });

  it('narrows to the requested IPv6 family', () => {
    expect(selectPinnedLookupAddresses([ipv4, ipv6], 6)).toEqual([ipv6]);
  });

  it('throws when no address matches the requested family', () => {
    expect(() => selectPinnedLookupAddresses([ipv4], 6)).toThrow('No validated public IPv6 address');
  });

  it('throws when a pinned address is private/reserved at connect time', () => {
    expect(() => selectPinnedLookupAddresses([{ address: '10.0.0.1', family: 4 }], undefined)).toThrow('private or reserved');
  });
});

// NOTE: createPinnedPublicIpDispatcher() constructs an undici Agent (a Node-only dependency),
// which cannot be loaded under this lib's jsdom test environment. Its IP-validation behavior is
// exercised through resolveHostnameToValidatedPublicIps above (the helper it delegates to); the
// connection-pinning (connect.lookup) is integration-tested at runtime.
