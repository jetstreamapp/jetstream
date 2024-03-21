import * as React from 'react';
function SvgAssetAudit(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <rect x={2} y={2} width={7} height={34} rx={1.5} fill="unset" />
      <rect x={43} y={2} width={7} height={34} rx={1.5} fill="unset" />
      <path
        d="M37.5 2h-3A1.63 1.63 0 0033 3.6V16a1 1 0 00.6.9 18.67 18.67 0 014.5 3.3.54.54 0 00.9-.3V3.6A1.63 1.63 0 0037.5 2zM24.1 15.2a12.1 12.1 0 011.9-.1 12.1 12.1 0 011.9.1 1 1 0 001.1-1V3.6A1.63 1.63 0 0027.5 2h-3A1.63 1.63 0 0023 3.6v10.6a1 1 0 001.1 1zM13.9 20.2a15 15 0 014.6-3.3 1.05 1.05 0 00.5-.9V3.6A1.63 1.63 0 0017.5 2h-3A1.63 1.63 0 0013 3.6v16.3c0 .4.5.6.9.3zM26 19.9a12.68 12.68 0 00-12.67 12.66A12.67 12.67 0 1026 19.9zm7.14 9.82l-8 8.8a1.62 1.62 0 01-1.26.53 1.77 1.77 0 01-1.27-.53l-4.28-4.21-.07-.09a.79.79 0 01.09-1.1l1.25-1.2a.88.88 0 011.24 0L23.83 35l6.78-7.6a.9.9 0 011.24 0l1.25 1.18a.93.93 0 01.03 1.14z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgAssetAudit;
