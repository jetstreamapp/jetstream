import * as React from 'react';
function SvgNotification(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M460 330h-5a35 35 0 01-35-35V180A160 160 0 00252 20c-86 4-152 78-152 165v111c0 19-16 34-35 34h-5c-22 0-40 19-40 41v15c0 7 7 14 15 14h450c8 0 15-7 15-15v-15a40 40 0 00-40-40zM309 440h-98a10 10 0 00-10 12c5 28 30 48 59 48s54-21 59-48a10 10 0 00-10-12z" />
    </svg>
  );
}
export default SvgNotification;
