import { GeoIpLookupResponse } from '@jetstream/types';
import { ENV } from '../config/env-config';
import { logger } from '../config/logger.config';

export interface GeoIpResult {
  city: string | null;
  country: string | null;
  countryCode: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
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
        latitude: entry.lat,
        longitude: entry.lon,
      });
    }
  } catch (error) {
    logger.warn({ error }, 'Geo-IP lookup failed, continuing without location data');
  }

  return result;
}

/**
 * Returns the great-circle distance in kilometres between two lat/lon points (haversine formula).
 */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Given a list of GeoIpResults, returns the maximum pairwise distance in km.
 * Returns 0 if fewer than 2 results have valid coordinates.
 */
export function maxPairwiseDistanceKm(geos: Array<GeoIpResult | null | undefined>): number {
  const coords = geos.filter((geo): geo is GeoIpResult & { latitude: number; longitude: number } => {
    return geo != null && geo.latitude != null && geo.longitude != null;
  });
  let maxDist = 0;
  for (let i = 0; i < coords.length; i++) {
    for (let j = i + 1; j < coords.length; j++) {
      const dist = haversineDistanceKm(coords[i].latitude, coords[i].longitude, coords[j].latitude, coords[j].longitude);
      if (dist > maxDist) {
        maxDist = dist;
      }
    }
  }
  return maxDist;
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
