import * as React from 'react';
function SvgLike(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M105 210H55c-8 0-15 7-15 15v230c0 8 7 15 15 15h25a40 40 0 0040-40V225c0-8-7-15-15-15zm335 10h-60a40 40 0 01-40-40V80a40 40 0 00-40-40h-25c-8 0-15 7-15 15v60c0 53-37 105-85 105-8 0-15 7-15 15v200c0 8 6 15 14 15 68 3 91 30 162 30 75 0 144-8 144-95V260a40 40 0 00-40-40z" />
    </svg>
  );
}
export default SvgLike;
