import * as React from 'react';
function SvgFilter(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M770 200H210c-19 0-28 21-16 35l242 286c8 9 11 21 11 33v227c0 10 10 19 20 19h44c10 0 18-9 18-19V555c0-13 5-24 14-33l243-286c12-14 3-36-16-36z" />
    </svg>
  );
}
export default SvgFilter;
