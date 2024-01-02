import * as React from 'react';
function SvgGpres(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <path
        d="M5.111.009A5.073 5.073 0 00.039 5.083v53.841a5.073 5.073 0 005.072 5.074h45.775a5.074 5.074 0 005.074-5.074V20.318L37.057.009H5.111z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#FCC003"
      />
      <path
        d="M10.123 37.465v11.9H22.54v-11.9H10.123zm11.289 9.642h-10.16v-7.386h10.16v7.386zm.674-5.128v2.259h8.386v7.385h-10.16v-2.846h-1.129v5.104h12.419V41.979h-9.516z"
        fill="#2E2204"
      />
      <g fillRule="evenodd" clipRule="evenodd">
        <path d="M55.96 20.377v1H43.161s-6.312-1.26-6.129-6.707c0 0 .208 5.707 6.004 5.707H55.96z" fill="#E4A201" />
        <path d="M37.058.025v14.561c0 1.656 1.104 5.791 6.104 5.791h12.799L37.058.025z" fill="#F9E3B6" />
      </g>
    </svg>
  );
}
export default SvgGpres;
