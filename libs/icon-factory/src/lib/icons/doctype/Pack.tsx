import * as React from 'react';
function SvgPack(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5600 6400" aria-hidden="true" {...props}>
      <path fill="#0b5cab" d="M515 1A507 507 0 008 509v5384c0 280 227 507 507 507h4578c280 0 507-227 507-507V2032L3710 1z" />
      <path fill="#032d60" d="M5598 2035v100H4318s-631-126-613-671c0 1 21 571 600 571z" />
      <path fill="#aacbff" d="M3707 0v1456c0 166 111 579 611 579h1280z" />
      <path
        fill="unset"
        d="M2919 4087v1192c0 66-53 119-119 119H1131c-66 0-119-53-119-119V4087c0-13 2-26 7-37l159-477c15-49 61-82 112-82h1351c51 0 97 33 112 82l159 477c5 11 7 24 7 37zm-245 0l-119-357H1376l-119 357z"
      />
    </svg>
  );
}
export default SvgPack;
