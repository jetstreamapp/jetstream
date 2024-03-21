import * as React from 'react';
function SvgOverlay(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <path
        d="M5.15.008A5.073 5.073 0 00.078 5.082v53.841a5.073 5.073 0 005.072 5.074h45.775a5.074 5.074 0 005.074-5.074V20.317L37.096.008H5.15z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#730394"
      />
      <g fillRule="evenodd" clipRule="evenodd">
        <path d="M55.977 20.352v1H43.178s-6.312-1.26-6.129-6.707c0 0 .208 5.707 6.004 5.707h12.924z" fill="#3D0157" />
        <path d="M37.074 0v14.561c0 1.656 1.104 5.791 6.104 5.791h12.799L37.074 0z" fill="#E5B9FE" />
      </g>
      <path d="M10.123 34.515v14.081h14.694V34.515H10.123zm5.344 5.343v14.081h14.694V39.858H15.467z" fill="unset" />
      <path fill="#E5B9FE" d="M15.467 39.858h9.351v8.737h-9.351z" />
    </svg>
  );
}
export default SvgOverlay;
