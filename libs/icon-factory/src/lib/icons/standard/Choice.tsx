import * as React from 'react';
function SvgChoice(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="unset" aria-hidden="true" {...props}>
      <path d="M50 20a30.1 30.1 0 00-30 30c0 16.5 13.5 30 30 30s30-13.5 30-30-13.5-30-30-30zm0 52c-12.1 0-22-9.9-22-22s9.9-22 22-22 22 9.9 22 22-9.9 22-22 22z" />
      <circle cx={50} cy={50} r={14} />
    </svg>
  );
}
export default SvgChoice;
