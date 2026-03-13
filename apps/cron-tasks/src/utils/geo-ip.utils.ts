import { ENV } from '../config/env-config';
import { logger } from '../config/logger.config';

export interface GeoIpResult {
  city?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  latitude?: number;
  longitude?: number;
}

interface GeoIpLookupResponse {
  success: boolean;
  results: Array<{
    ipAddress: string;
    isValid: boolean;
    city?: string;
    country?: string;
    countryCode?: string;
    region?: string;
    latitude?: number;
    longitude?: number;
  }>;
}

/**
 * Bulk-lookup geo-IP data for a list of IP addresses via the internal geo-IP service.
 * Returns an empty Map gracefully if the service is unavailable or not configured.
 */
export async function lookupIpAddresses(ips: string[]): Promise<Map<string, GeoIpResult | null>> {
  const result = new Map<string, GeoIpResult | null>();

  if (!ENV.GEO_IP_API_HOSTNAME || !ENV.GEO_IP_API_USERNAME || !ENV.GEO_IP_API_PASSWORD) {
    logger.warn('Geo-IP service not configured, skipping IP enrichment');
    return result;
  }

  if (ips.length === 0) {
    return result;
  }

  try {
    const credentials = Buffer.from(`${ENV.GEO_IP_API_USERNAME}:${ENV.GEO_IP_API_PASSWORD}`).toString('base64');
    const response = await fetch(`${ENV.GEO_IP_API_HOSTNAME}/api/lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({ ips }),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Geo-IP service returned non-OK response');
      return result;
    }

    const data = (await response.json()) as GeoIpLookupResponse;

    for (const entry of data.results) {
      if (!entry.isValid) {
        result.set(entry.ipAddress, null);
        continue;
      }

      result.set(entry.ipAddress, {
        city: entry.city,
        country: entry.country,
        countryCode: entry.countryCode,
        region: entry.region,
        latitude: entry.latitude,
        longitude: entry.longitude,
      });
    }
  } catch (error) {
    logger.warn({ error }, 'Geo-IP lookup failed, continuing without location data');
  }

  return result;
}

/**
 * Formats a geo-IP result as a short location string, e.g. "San Francisco, US"
 */
export function formatLocation(geo: GeoIpResult | null | undefined): string {
  if (!geo) {
    return '';
  }
  const parts = [geo.city, geo.countryCode || geo.country].filter(Boolean);
  return parts.join(', ');
}
