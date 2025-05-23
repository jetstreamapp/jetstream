import * as React from 'react';
function SvgShare(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M485 300h-30c-8 0-15 7-15 15v110c0 8-7 15-15 15H95c-8 0-15-7-15-15V215c0-8 7-15 15-15h40c8 0 15-7 15-15v-30c0-8-7-15-15-15H60a40 40 0 00-40 40v280a40 40 0 0040 40h400a40 40 0 0040-40V315c0-8-7-15-15-15zM340 140c-100 0-191 89-199 194-1 8 6 16 15 16h30c8 0 14-6 15-13 7-75 71-137 149-137h16c9 0 13 11 7 17l-55 56c-6 6-6 15 0 21l21 21c6 6 15 6 21 0l136-135c6-6 6-15 0-21L361 24c-6-6-15-6-21 0l-21 21c-6 6-7 15-1 21l56 56c6 6 2 17-7 17l-27 1z" />
    </svg>
  );
}
export default SvgShare;
