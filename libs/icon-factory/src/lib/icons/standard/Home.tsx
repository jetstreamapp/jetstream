import * as React from 'react';
function SvgHome(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M788 512h-63v275c0 8-5 12-13 12H588c-8 0-13-5-13-12V575H425v212c0 8-5 12-13 12H288c-8 0-13-5-13-12V512h-63c-5 0-10-2-11-8-3-5-1-10 3-14l288-288c5-5 14-5 18 0l288 288c4 4 4 9 3 14s-8 8-13 8z" />
    </svg>
  );
}
export default SvgHome;
