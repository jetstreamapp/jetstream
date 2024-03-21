import * as React from 'react';
function SvgGdoc(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <path
        d="M5.112.011A5.074 5.074 0 00.039 5.085v53.841A5.074 5.074 0 005.112 64h45.775a5.074 5.074 0 005.074-5.074V20.321L37.057.011H5.112z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#1B96FF"
      />
      <path
        d="M10.133 37.439h21.564v2.059H10.133zm0 4.801h21.564v2.057H10.133zm0 4.801h21.564v2.057H10.133zm0 4.8h12.233v2.058H10.133z"
        fill="unset"
      />
      <g fillRule="evenodd" clipRule="evenodd">
        <path d="M55.96 20.377v1H43.161s-6.312-1.26-6.129-6.707c0 0 .208 5.707 6.004 5.707H55.96z" fill="#0B5CAB" />
        <path d="M37.058.025v14.561c0 1.656 1.104 5.791 6.104 5.791h12.799L37.058.025z" fill="#AACBFF" />
      </g>
    </svg>
  );
}
export default SvgGdoc;
