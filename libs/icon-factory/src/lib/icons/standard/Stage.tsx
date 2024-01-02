import * as React from 'react';
function SvgStage(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <circle fill="unset" cx={75.9} cy={50} r={4.2} />
      <circle fill="unset" cx={49.8} cy={50} r={4.2} />
      <circle fill="unset" cx={24.1} cy={50} r={4.2} />
      <path
        fill="unset"
        d="M31.9 50c0 9.9 8.1 18 18 18s18-8.1 18-18-8.1-18-18-18-18 8.1-18 18zm30 0c0 6.6-5.4 12-12 12s-12-5.4-12-12 5.4-12 12-12 12 5.4 12 12z"
      />
    </svg>
  );
}
export default SvgStage;
