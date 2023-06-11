import * as React from 'react';
function SvgSetupModal(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M78.12 20H21.88c-1 0-1.88.88-1.88 1.88v40.5c0 1 .88 1.88 1.88 1.88h56.25c1 0 1.88-.88 1.88-1.88v-40.5c0-1-.88-1.88-1.88-1.88z"
        fill="unset"
      />
      <circle cx={42.5} cy={75} r={5} fill="unset" />
      <circle cx={27.5} cy={75} r={5} fill="unset" />
      <path
        d="M57.5 72.5c1.37 0 2.5 1.13 2.5 2.5s-1.13 2.5-2.5 2.5S55 76.37 55 75s1.12-2.5 2.5-2.5m0-2.5c-2.75 0-5 2.25-5 5s2.25 5 5 5 5-2.25 5-5-2.25-5-5-5z"
        fill="unset"
      />
      <circle cx={72.5} cy={75} r={5} fill="unset" />
    </svg>
  );
}
export default SvgSetupModal;
