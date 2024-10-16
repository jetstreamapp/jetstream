import * as React from 'react';
function SvgFeed(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M490 720c-4 0-9-1-14-4-8-4-14-13-16-22l-78-312-65 149c-4 12-15 19-27 19h-90c-11 0-20-9-20-20v-20c0-11 9-20 20-20h70l92-212c5-12 17-19 30-18s24 10 27 23l79 316 104-231c5-12 17-19 30-18 11 1 21 9 26 20l52 120h90c11 0 20 9 20 20v20c0 11-9 20-20 20H690c-12 0-23-7-28-18l-33-77-112 247c-5 11-15 18-27 18z" />
    </svg>
  );
}
export default SvgFeed;
