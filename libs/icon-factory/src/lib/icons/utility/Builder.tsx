import * as React from 'react';
function SvgBuilder(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M115 170H35c-8 0-15 7-15 15v255a40 40 0 0040 40h55c8 0 15-7 15-15V185c0-8-7-15-15-15zm370 0H185c-8 0-15 7-15 15v280c0 8 7 15 15 15h275a40 40 0 0040-40V185c0-8-7-15-15-15zM460 40H60a40 40 0 00-40 40v35c0 8 7 15 15 15h450c8 0 15-7 15-15V80a40 40 0 00-40-40z" />
    </svg>
  );
}
export default SvgBuilder;
