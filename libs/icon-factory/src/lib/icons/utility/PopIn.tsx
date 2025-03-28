import * as React from 'react';
function SvgPopIn(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M220 313h191c8 0 16-5 16-13v-30c0-8-7-17-16-17h-79c-9 0-14-10-7-16L495 67c6-6 6-15 0-21l-21-21c-6-6-15-6-21 0L283 195c-6 6-16 2-16-7v-79c0-8-8-17-16-17h-29c-8 0-15 9-15 17v190c1 9 5 13 13 14zm150 40h-40c-6 0-10 4-10 10v62c0 8-7 15-15 15H95c-8 0-15-7-15-15V215c0-8 7-15 14-15h63c6 0 10-4 10-10v-40c0-6-4-10-10-10H60a40 40 0 00-40 40v280a40 40 0 0040 40h280a40 40 0 0040-40v-97c0-6-4-10-10-10z" />
    </svg>
  );
}
export default SvgPopIn;
