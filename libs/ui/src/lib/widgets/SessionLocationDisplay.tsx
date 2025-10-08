import { SessionIpData } from '@jetstream/auth/types';

export function SessionLocationDisplay({ location }: { location: SessionIpData }) {
  if (location.status !== 'success') {
    return null;
  }
  const { city, region, countryCode, lat, lon } = location;

  const estimatedLocation = [city, region, countryCode].filter(Boolean).join(', ');

  if (lat && lon) {
    return (
      <span>
        (Est. location:{' '}
        <a href={`https://www.google.com/maps?q=${lat},${lon}`} target="_blank" rel="noopener noreferrer">
          {estimatedLocation}
        </a>
        )
      </span>
    );
  }

  return <span>(Est. location: {estimatedLocation})</span>;
}
