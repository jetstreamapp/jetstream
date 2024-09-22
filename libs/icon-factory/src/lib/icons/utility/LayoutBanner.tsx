import * as React from 'react';
function SvgLayoutBanner(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M20 49a29 29 0 0129-29h421a29 29 0 0130 29v421a29 29 0 01-29 29H50a29 29 0 01-30-28zm72 173a24 24 0 0124-24h278a24 24 0 110 48H116a24 24 0 01-24-24zm82 52a24 24 0 100 48h163a24 24 0 000-48z"
      />
    </svg>
  );
}
export default SvgLayoutBanner;
