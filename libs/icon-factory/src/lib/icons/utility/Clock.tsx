import * as React from 'react';
function SvgClock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M26 2C12.8 2 2 12.8 2 26s10.8 24 24 24 24-10.8 24-24S39.2 2 26 2zm0 42c-9.9 0-18-8.1-18-18S16.1 8 26 8s18 8.1 18 18-8.1 18-18 18z" />
        <path d="M29.4 26.2c-.3-.3-.4-.7-.4-1.1v-9.6c0-.8-.7-1.5-1.5-1.5h-3c-.8 0-1.5.7-1.5 1.5v12.1c0 .4.2.8.4 1.1l7.4 7.4c.6.6 1.5.6 2.1 0L35 34c.6-.6.6-1.5 0-2.1l-5.6-5.7z" />
      </g>
    </svg>
  );
}
export default SvgClock;
