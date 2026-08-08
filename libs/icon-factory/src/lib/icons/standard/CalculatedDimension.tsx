import * as React from 'react';
function SvgCalculatedDimension(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M639 552L538 303c-1-5-6-8-11-8h-32c-5 0-10 4-11 8l-92 249c-2 5 1 11 6 11h35c5 0 10-4 11-9l23-65h91l26 65c1 5 6 9 11 9h35c6 0 10-6 7-11zM487 439l26-68 29 68zm313 250l-3-88v-51c0-11 0-22-4-33-11-29-50-35-78-35-25 0-49 6-71 16l9 23a30 30 0 013 13c19-8 37-13 56-13 29 0 44 11 44 34v11h-21c-37 0-65 5-85 16-19 11-29 31-29 58s6 37 19 48 29 17 48 17 31-2 42-7 20-12 27-22h1l4 24h36v-11zm-42-72c0 5 0 10-3 15a30 30 0 01-6 11 56 56 0 01-38 21h-27c-7-1-14-5-18-11-6-10-5-26 2-35 4-6 11-9 17-11 18-6 39-6 56-6h16v17zM210 423h132c5 0 10 4 10 10v31c0 5-4 10-10 10H210a10 10 0 01-10-10v-31c0-5 4-10 10-10m0 111h132c5 0 10 4 10 10v31c0 5-4 10-10 10H210a10 10 0 01-10-10v-31c0-5 4-10 10-10" />
    </svg>
  );
}
export default SvgCalculatedDimension;
