import * as React from 'react';
function SvgStage(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <circle fill="unset" cx={46.7} cy={26} r={3.4} />
      <circle fill="unset" cx={25.9} cy={26} r={3.4} />
      <circle fill="unset" cx={5.4} cy={26} r={3.4} />
      <path
        fill="unset"
        d="M11.6 26c0 7.9 6.5 14.4 14.4 14.4S40.3 33.9 40.3 26 33.9 11.6 26 11.6 11.6 18.1 11.6 26zm23.9 0c0 5.3-4.3 9.6-9.6 9.6s-9.6-4.3-9.6-9.6 4.3-9.6 9.6-9.6 9.6 4.3 9.6 9.6z"
      />
    </svg>
  );
}
export default SvgStage;
