import * as React from 'react';
function SvgQuip(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="unset" aria-hidden="true" {...props}>
      <path d="M48.1 20.1c-14.9.9-27.1 13.1-28 28A29.97 29.97 0 0050 80h30V50c0-17.2-14.5-31-31.9-29.9zM35.8 37c0-1.1.9-2 2-2h24.5a2 2 0 012 2v2a2 2 0 01-2 2H37.8a2 2 0 01-2-2zm28.5 26a2 2 0 01-2 2H37.8a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h24.5a2 2 0 012 2zm7.5-12a2 2 0 01-2 2H30.2a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h39.6a2 2 0 012 2z" />
    </svg>
  );
}
export default SvgQuip;
