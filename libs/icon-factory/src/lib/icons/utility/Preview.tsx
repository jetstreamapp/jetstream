import * as React from 'react';
function SvgPreview(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M51.8 25.1C47.1 15.6 37.3 9 26 9S4.9 15.6.2 25.1c-.3.6-.3 1.3 0 1.8C4.9 36.4 14.7 43 26 43s21.1-6.6 25.8-16.1c.3-.6.3-1.2 0-1.8zM26 37c-6.1 0-11-4.9-11-11s4.9-11 11-11 11 4.9 11 11-4.9 11-11 11z" />
        <path d="M26 19c-3.9 0-7 3.1-7 7s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7z" />
      </g>
    </svg>
  );
}
export default SvgPreview;
