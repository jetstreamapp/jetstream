import * as React from 'react';
function SvgMove(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M49.7 25.3l-8.3-9c-.6-.6-1.4-.1-1.4.9V23H30c-.6 0-1-.4-1-1V12h5.9c1 0 1.5-.9.9-1.4l-9-8.3c-.4-.3-1-.3-1.4 0l-9 8.3c-.6.6-.1 1.4.9 1.4H23v10c0 .6-.4 1-1 1H12v-5.9c0-1-.9-1.5-1.4-.9l-8.3 9c-.3.4-.3 1 0 1.4l8.3 9c.6.6 1.4.1 1.4-.9V29h10c.6 0 1 .4 1 1v10h-5.9c-1 0-1.5.9-.9 1.4l9 8.3c.4.3 1 .3 1.4 0l9-8.3c.6-.6.1-1.4-.9-1.4H29V30c0-.6.4-1 1-1h10v5.9c0 1 .9 1.5 1.4.9l8.3-9c.4-.5.4-1.1 0-1.5z"
      />
    </svg>
  );
}
export default SvgMove;
