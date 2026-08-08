import * as React from 'react';
function SvgSlide(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <path d="M37 0l19 20v38c0 3.31-2.69 6-6 6H6c-3.31 0-6-2.69-6-6V6c0-3.31 2.69-6 6-6h31z" fill="#0d9dda" />
      <path d="M37 0l19 20v1H44c-3.87 0-7-3.13-7-7V0z" fill="#05628a" />
      <path d="M43 20h13L37 0v14c0 3.31 2.69 6 6 6z" fill="#90d0fe" />
      <path d="M10 34v20h21V34H10zm19.09 16.21H11.91v-12.4h17.18v12.4z" fill="unset" />
    </svg>
  );
}
export default SvgSlide;
