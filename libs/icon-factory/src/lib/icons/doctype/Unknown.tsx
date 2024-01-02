import * as React from 'react';
function SvgUnknown(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <g fillRule="evenodd" clipRule="evenodd">
        <path
          d="M5.113.007A5.073 5.073 0 00.039 5.081v53.84a5.073 5.073 0 005.074 5.074h45.774a5.074 5.074 0 005.074-5.074V20.315L37.058.007H5.113z"
          fill="#747474"
        />
        <path d="M55.976 20.352v1H43.177s-6.312-1.26-6.129-6.707c0 0 .208 5.707 6.004 5.707h12.924z" fill="#5C5C5C" />
        <path d="M37.074 0v14.561c0 1.656 1.104 5.791 6.104 5.791h12.799L37.074 0z" fill="#C9C9C9" />
      </g>
    </svg>
  );
}
export default SvgUnknown;
