import * as React from 'react';
function SvgOverlay(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5600 6400" aria-hidden="true" {...props}>
      <path fill="#730394" d="M515 1A507 507 0 008 508v5384c0 281 227 508 507 508h4578c280 0 507-227 507-508V2032L3710 1z" />
      <path fill="#3d0157" d="M5598 2035v100H4318s-631-126-613-671c0 1 21 571 600 571z" />
      <path fill="#e5b9fe" d="M3707 0v1456c0 166 111 579 611 579h1280z" />
      <path fill="unset" d="M1012 3452v1408h1470V3452zm535 534v1408h1469V3986z" />
      <path fill="#e5b9fe" d="M1547 3986h935v873l-935 1z" />
    </svg>
  );
}
export default SvgOverlay;
