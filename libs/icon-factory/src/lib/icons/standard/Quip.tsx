import * as React from 'react';
function SvgQuip(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M48.1 20.1c-14.9.9-27.1 13.1-28 28C19 65.5 32.8 80 50 80h30V50c0-17.2-14.5-31-31.9-29.9zM35.8 37c0-1.1.9-2 2-2h24.5c1.1 0 2 .9 2 2v2c0 1.1-.9 2-2 2H37.8c-1.1 0-2-.9-2-2v-2zm28.5 26c0 1.1-.9 2-2 2H37.8c-1.1 0-2-.9-2-2v-2c0-1.1.9-2 2-2h24.5c1.1 0 2 .9 2 2v2zm7.5-12c0 1.1-.9 2-2 2H30.2c-1.1 0-2-.9-2-2v-2c0-1.1.9-2 2-2h39.6c1.1 0 2 .9 2 2v2z"
      />
    </svg>
  );
}
export default SvgQuip;
