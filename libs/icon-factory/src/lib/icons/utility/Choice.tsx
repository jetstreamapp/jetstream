import * as React from 'react';
function SvgChoice(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M260 20C128 20 20 128 20 260s108 240 240 240 240-108 240-240S392 20 260 20zm0 416a176 176 0 111-353 176 176 0 01-1 353z" />
      <circle cx={260} cy={260} r={112} />
    </svg>
  );
}
export default SvgChoice;
