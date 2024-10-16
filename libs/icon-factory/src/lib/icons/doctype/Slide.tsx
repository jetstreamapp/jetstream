import * as React from 'react';
function SvgSlide(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5600 6400" aria-hidden="true" {...props}>
      <path fill="#0d9dda" d="M515 1A507 507 0 008 508v5384c0 281 227 508 507 508h4578c280 0 507-227 507-508V2032L3710 1z" />
      <path fill="unset" d="M1012 3477v1909h1992V3477zm1811 1547H1193V3840h1630z" />
      <path fill="#05628a" d="M5598 2035v100H4318s-631-126-613-671c0 1 21 571 600 571z" />
      <path fill="#90d0fe" d="M3707 0v1456c0 166 111 579 611 579h1280z" />
    </svg>
  );
}
export default SvgSlide;
