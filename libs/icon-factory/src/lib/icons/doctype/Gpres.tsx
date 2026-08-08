import * as React from 'react';
function SvgGpres(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <path d="M37 0l19 20v38c0 3.31-2.69 6-6 6H6c-3.31 0-6-2.69-6-6V6c0-3.31 2.69-6 6-6h31z" fill="#fcc003" />
      <path d="M37 0l19 20v1H44c-3.87 0-7-3.13-7-7V0z" fill="#e4a201" />
      <path d="M43 20h13L37 0v14c0 3.31 2.69 6 6 6z" fill="#f9e3b6" />
      <path
        d="M22.11 38v4.4h8.83V54H18.83v-4.4H10V38h12.11zm0 11.6h-2.17v2.19h9.91v-7.2h-7.73v5zM11.1 40.19v7.21h9.91v-7.21H11.1z"
        fill="#2e2204"
        fillRule="evenodd"
      />
    </svg>
  );
}
export default SvgGpres;
