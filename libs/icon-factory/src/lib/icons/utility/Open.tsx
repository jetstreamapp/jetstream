import * as React from 'react';
function SvgOpen(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M80 350v-6 12-6zM460 20H60a40 40 0 00-40 40v360a40 40 0 0040 40h120c6 0 10-4 10-10v-40c0-6-4-10-10-10H95c-8 0-15-7-15-15V135c0-8 7-15 15-15h330c8 0 15 7 15 15v250c0 8-7 15-15 15h-85c-6 0-10 4-10 10v40c0 6 4 10 10 10h120a40 40 0 0040-40V60a40 40 0 00-40-40zm-85 326l21-21c6-6 6-15 0-21L270 178c-6-6-15-6-21 0L124 303c-6 6-6 15 0 21l21 21c6 6 15 6 21 0l46-46c6-6 18-2 18 7v179c0 8 6 15 14 15h30c8 0 16-7 16-15V306c0-9 10-13 17-7l46 47c6 5 16 5 22 0z" />
    </svg>
  );
}
export default SvgOpen;
