import * as React from 'react';
function SvgWaits(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M80 40.5c0-1-.9-1.9-1.9-1.9H51.9c-1 0-1.9.9-1.9 1.9v3.7c0 1 .9 1.9 1.9 1.9h17.8L50.4 69.8s0 .1-.1.1c-.2.3-.4.7-.4 1.1v3.7c0 1 .9 1.9 1.9 1.9h26.3c1 0 1.9-.9 1.9-1.9V71c0-1-.9-1.9-1.9-1.9H60.6l19-23.3c.3-.4.4-.8.3-1.3v-4z"
      />
      <path
        fill="unset"
        d="M50 25.3c0-1-.9-1.9-1.9-1.9H21.9c-1 0-1.9.9-1.9 1.9V29c0 1 .9 1.9 1.9 1.9h17.8L20.4 54.6s0 .1-.1.1c-.2.3-.3.6-.3 1v3.7c0 1 .9 1.9 1.9 1.9h26.3c1 0 1.9-.9 1.9-1.9v-3.7c0-1-.9-1.9-1.9-1.9H30.6l19-23.3c.3-.4.4-.8.3-1.3V25.3z"
      />
    </svg>
  );
}
export default SvgWaits;
