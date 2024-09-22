import * as React from 'react';
function SvgDataset(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M520 206l234 115c16 8 26 24 26 41v268c0 18-10 34-26 41L520 786c-13 6-28 6-41 0L246 671c-16-8-26-24-26-41V362c0-18 10-34 26-41l234-115c12-6 28-6 40 0z" />
    </svg>
  );
}
export default SvgDataset;
