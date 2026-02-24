import * as dns from 'dns/promises';
import { assertDomainResolvesToPublicIp } from '../network.utils';

vi.mock('dns/promises');

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
