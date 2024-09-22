import * as React from 'react';
function SvgIncident(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="unset" aria-hidden="true" {...props}>
      <path d="M38 30h4a.9.9 0 001-1v-3h14v3a.9.9 0 001 1h4a.9.9 0 001-1v-3a6 6 0 00-6-6H43a6 6 0 00-6 6v3a.9.9 0 001 1zm12 33.3a2.2 2.2 0 102.2 2.3 2.2 2.2 0 00-2.2-2.3zM74 36H26a6 6 0 00-6 6v32a6 6 0 006 6h48a6 6 0 006-6V42a6 6 0 00-6-6zm-6.9 37.8H32.9c-1.9 0-2.9-2.4-1.9-4.1L48.2 42a2.1 2.1 0 013.7 0L69 69.7c1.1 1.7 0 4.1-1.9 4.1z" />
      <rect width={4.5} height={11.2} x={47.8} y={50.6} rx={0.8} />
    </svg>
  );
}
export default SvgIncident;
