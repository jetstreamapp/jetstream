import * as React from 'react';
function SvgMedication(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M30.71 26.18h26.57a1.34 1.34 0 001.33-1.26V21.3a1.33 1.33 0 00-1.3-1.3h-26.6a1.32 1.32 0 00-1.33 1.3V25a1.33 1.33 0 001.33 1.18z"
        fill="unset"
      />
      <rect x={27.18} y={45.34} width={13.06} height={3.02} rx={0.98} fill="unset" />
      <rect x={27.18} y={52.83} width={9.15} height={3.02} rx={0.98} fill="unset" />
      <path
        d="M60.86 52.54v-14a9.05 9.05 0 00-9-9.14H36.28a9.06 9.06 0 00-9.15 9v2.54h16.61a1.46 1.46 0 011.46 1.46v16.69a1.46 1.46 0 01-1.46 1.47H27.13v7.3a1.41 1.41 0 001.47 1.3h18.19l14-16.55zM71.2 55.11a6.32 6.32 0 00-8.89.73l-4.78 5.64 9.62 8.15L71.93 64a6.32 6.32 0 00-.73-8.89zM50.66 69.62a6.3 6.3 0 009.62 8.15l4.78-5.63L55.44 64z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgMedication;
