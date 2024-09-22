import * as React from 'react';
function SvgAudio(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5600 6400" aria-hidden="true" {...props}>
      <path fill="#0d9dda" d="M515 1A507 507 0 008 509v5384c0 280 227 507 507 507h4578c280 0 507-227 507-507V2032L3710 1z" />
      <path fill="#05628a" d="M5600 2036v100H4320s-631-126-613-671c0 0 21 571 600 571z" />
      <path fill="#90d0fe" d="M3710 1v1456c0 165 110 579 610 579h1280z" />
      <path
        fill="unset"
        d="M2980 3404l-1417 181v1344c-74-21-163-24-253-7-201 40-332 171-294 292 39 122 233 188 434 148 176-35 299-139 300-247V4041l1043-129v831c-75-21-166-25-258-7-203 40-335 172-296 295 38 123 235 189 437 150 185-37 312-150 304-263z"
      />
    </svg>
  );
}
export default SvgAudio;
