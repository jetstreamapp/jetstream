import * as React from 'react';
function SvgTabset(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M31.6 2H20.4c-.7 0-1.2.6-1.2 1.3v2.5c0 .7.6 1.3 1.2 1.3h11.2c.7 0 1.2-.6 1.2-1.3V3.3c.1-.7-.5-1.3-1.2-1.3zM48.7 2H37.5c-.7 0-1.3.6-1.3 1.3v2.5c0 .7.6 1.3 1.3 1.3h11.2c.7-.1 1.3-.6 1.3-1.3V3.3c0-.7-.6-1.3-1.3-1.3z"
      />
      <path
        fill="unset"
        d="M48.7 10.4H17c-.7 0-1.3-.6-1.3-1.3V3.3c0-.7-.6-1.3-1.3-1.3H3.3C2.6 2 2 2.6 2 3.3v45.5c0 .6.6 1.2 1.3 1.2H48.7c.7 0 1.3-.6 1.3-1.3v-37c0-.7-.6-1.3-1.3-1.3z"
      />
    </svg>
  );
}
export default SvgTabset;
