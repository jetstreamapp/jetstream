import * as React from 'react';
function SvgFlash(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5600 6400" aria-hidden="true" {...props}>
      <path fill="#ea001e" d="M511 1A507 507 0 004 508v5384c0 281 227 508 507 508h4578c280 0 507-227 507-508V2032L3706 1z" />
      <path fill="#ba0517" d="M5596 2035v100H4316s-631-126-613-671c0 0 21 571 601 571z" />
      <path fill="#fe8f7d" d="M3706-1v1457c0 165 110 579 610 579h1280z" />
      <path
        fill="unset"
        d="M1747 4311h-584v387h571c36 0 65 28 65 68 0 36-29 65-65 65h-571v484c0 42-32 74-75 74-42 0-74-32-74-74V4285c0-59 49-108 108-108h625c36 0 65 29 65 69-1 36-29 65-65 65zm955 1067h-545c-60 0-108-48-108-108V4238c0-39 32-71 77-71 40 0 72 32 72 72v1006h504c36 0 65 29 65 65 0 40-29 68-65 68zm1223 11c-31 0-60-18-72-48l-90-229h-598l-90 229a78 78 0 01-72 48 80 80 0 01-76-108l414-1033a130 130 0 01242 0l417 1033c4 9 6 20 6 29 0 36-33 79-81 79zm-461-1057l-256 647h510z"
      />
    </svg>
  );
}
export default SvgFlash;
