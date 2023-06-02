import * as React from 'react';
function SvgChoice(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <circle cx={26} cy={26} r={11.2} />
        <path d="M26 2C12.8 2 2 12.8 2 26s10.8 24 24 24 24-10.8 24-24S39.2 2 26 2zm0 41.6c-9.7 0-17.6-7.9-17.6-17.6S16.3 8.4 26 8.4 43.6 16.3 43.6 26 35.7 43.6 26 43.6z" />
      </g>
    </svg>
  );
}
export default SvgChoice;
