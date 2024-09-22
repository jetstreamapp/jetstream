import * as React from 'react';
function SvgApexPlugin(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M502 400l140-140c7-7 7-19 0-26l-30-30c-7-7-19-7-26 0L446 344zm154 158l140-140c7-7 7-19 0-26l-30-30c-7-7-19-7-26 0L600 502zm-20 116l5-10c1-5 0-10-3-14l-2-3-1-1-282-282-1-1c-3-4-9-5-13-5-6 0-10 3-14 6l-7 7-4 5-5 6-5 8-5 10-6 11-5 13-5 15-5 17-4 20-4 22-3 24-2 27v30l1 33 2 36 1 10h2l-65 65c-7 7-7 19 0 26l46 46c7 7 19 7 26 0l65-65c23 2 47 4 71 4 20 0 39 0 59-2a393 393 0 00115-26l21-11c9-6 18-12 25-20z" />
    </svg>
  );
}
export default SvgApexPlugin;
