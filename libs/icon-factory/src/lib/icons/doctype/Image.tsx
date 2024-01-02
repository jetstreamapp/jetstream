import * as React from 'react';
function SvgImage(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <g fillRule="evenodd" clipRule="evenodd">
        <path
          d="M5.125.042A5.074 5.074 0 00.053 5.116v53.841a5.072 5.072 0 005.072 5.073H50.9a5.074 5.074 0 005.074-5.073V20.353L37.07.042H5.125z"
          fill="#06A59A"
        />
        <path d="M55.977 20.352v1H43.178s-6.312-1.26-6.129-6.707c0 0 .208 5.707 6.004 5.707h12.924z" fill="#056764" />
        <path d="M37.074 0v14.561c0 1.656 1.104 5.791 6.104 5.791h12.799L37.074 0z" fill="#ACF3E4" />
      </g>
      <path
        d="M10.119 53.739V32.835h20.906v20.904H10.119zm18.799-18.843H12.227v12.6h16.691v-12.6zm-9.583 8.384l3.909-5.256 1.207 2.123 1.395-.434.984 5.631H13.748l3.496-3.32 2.091 1.256zm-3.856-3.64c-.91 0-1.649-.688-1.649-1.538 0-.849.739-1.538 1.649-1.538.912 0 1.65.689 1.65 1.538 0 .85-.738 1.538-1.65 1.538z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="unset"
      />
    </svg>
  );
}
export default SvgImage;
