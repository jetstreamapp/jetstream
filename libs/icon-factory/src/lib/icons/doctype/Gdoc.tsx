import * as React from 'react';
function SvgGdoc(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <path d="M37 0l19 20v38c0 3.31-2.69 6-6 6H6c-3.31 0-6-2.69-6-6V6c0-3.31 2.69-6 6-6h31z" fill="#1b96ff" />
      <path d="M37 0l19 20v1H44c-3.87 0-7-3.13-7-7V0z" fill="#0b5cab" />
      <path d="M43 20h13L37 0v14c0 3.31 2.69 6 6 6z" fill="#aacbff" />
      <path d="M10 38h21v2.01H10V38zm0 4.67h21v2.01H10v-2.01zm0 4.68h21v2.01H10v-2.01zm0 4.67h11.92v2.01H10v-2.01z" fill="unset" />
    </svg>
  );
}
export default SvgGdoc;
