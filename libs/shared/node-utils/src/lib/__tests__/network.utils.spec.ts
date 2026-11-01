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

  describe('IPv6 forms that embed or alias a private address', () => {
    it.each([
      ['IPv4-mapped loopback, dotted form', '::ffff:127.0.0.1'],
      ['IPv4-mapped loopback, hex form', '::ffff:7f00:1'],
      ['IPv4-mapped loopback, fully expanded', '0000:0000:0000:0000:0000:ffff:7f00:0001'],
      ['IPv4-mapped RFC 1918, hex form', '::ffff:a00:1'],
      ['IPv4-mapped cloud metadata, hex form', '::ffff:a9fe:a9fe'],
      ['IPv4-compatible loopback (::/96)', '::7f00:1'],
      ['NAT64 well-known prefix wrapping loopback', '64:ff9b::7f00:1'],
      ['NAT64 local-use prefix', '64:ff9b:1::a'],
      ['6to4 wrapping loopback', '2002:7f00:1::1'],
      ['documentation range', '2001:db8::1'],
      ['discard-only range', '100::1'],
      ['link-local inside fe80::/10 but not starting with fe80', 'fe90::1'],
      ['link-local at the top of fe80::/10', 'febf::1'],
      ['unique local fc00::/7', 'fc00::1'],
      ['multicast', 'ff02::1'],
      ['unspecified', '::'],
    ])('rejects %s (%s) as a resolved AAAA record', async (_label, address) => {
      mockedDns.resolve4.mockRejectedValue(new Error('no A'));
      mockedDns.resolve6.mockResolvedValue([address]);

      await expect(assertDomainResolvesToPublicIp('evil.com')).rejects.toThrow('private or reserved');
    });

    it.each([
      ['IPv4-mapped loopback, hex form', '::ffff:7f00:1'],
      ['IPv4-compatible loopback', '::7f00:1'],
      ['link-local fe90::1', 'fe90::1'],
      ['link-local with a zone id', 'fe80::1%eth0'],
    ])('rejects %s (%s) as a raw IP literal without a DNS lookup', async (_label, address) => {
      await expect(assertDomainResolvesToPublicIp(address)).rejects.toThrow('private or reserved');
      expect(mockedDns.resolve4).not.toHaveBeenCalled();
      expect(mockedDns.resolve6).not.toHaveBeenCalled();
    });
  });

  describe('public addresses are still accepted', () => {
    it.each([
      ['Cloudflare DNS IPv6', '2606:4700::1111'],
      ['Facebook IPv6', '2a03:2880:f12f:83:face:b00c:0:25de'],
      ['the IPv6 address just past the NAT64 prefix', '64:ff9c::1'],
      ['the IPv6 address just past the documentation range', '2001:db9::1'],
      ['site-local (deprecated but not link-local) fec0::1', 'fec0::1'],
    ])('allows %s (%s) as a resolved AAAA record', async (_label, address) => {
      mockedDns.resolve4.mockRejectedValue(new Error('no A'));
      mockedDns.resolve6.mockResolvedValue([address]);

      await expect(assertDomainResolvesToPublicIp('example.com')).resolves.toBeUndefined();
    });

    it.each([
      ['Google DNS', '8.8.8.8'],
      ['IPv4-mapped public address', '::ffff:8.8.8.8'],
      ['the last address before multicast', '223.255.255.255'],
      ['the address just past 172.16.0.0/12', '172.32.0.1'],
    ])('allows %s (%s) as a raw IP literal', async (_label, address) => {
      await expect(assertDomainResolvesToPublicIp(address)).resolves.toBeUndefined();
    });

    it('rejects the limited broadcast address and multicast IPv4 addresses', async () => {
      await expect(assertDomainResolvesToPublicIp('255.255.255.255')).rejects.toThrow('private or reserved');
      await expect(assertDomainResolvesToPublicIp('224.0.0.1')).rejects.toThrow('private or reserved');
    });
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
