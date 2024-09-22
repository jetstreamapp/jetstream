import * as React from 'react';
function SvgPhoto(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M260 200c-44 0-80 36-80 80s36 80 80 80 80-36 80-80-36-80-80-80z" />
      <path d="M460 140h-52c-14 0-26-7-34-18l-23-35a45 45 0 00-42-27h-98c-18 0-35 10-43 27l-23 35a40 40 0 01-34 18H60a40 40 0 00-40 40v240a40 40 0 0040 40h400a40 40 0 0040-40V180a40 40 0 00-40-40zM260 400c-66 0-120-54-120-120s54-120 120-120 120 54 120 120-54 120-120 120z" />
    </svg>
  );
}
export default SvgPhoto;
