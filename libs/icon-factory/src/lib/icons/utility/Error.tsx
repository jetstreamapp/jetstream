import * as React from 'react';
function SvgError(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M26 2C12.8 2 2 12.8 2 26s10.8 24 24 24 24-10.8 24-24S39.2 2 26 2zM8 26c0-9.9 8.1-18 18-18 3.9 0 7.5 1.2 10.4 3.3L11.3 36.4C9.2 33.5 8 29.9 8 26zm18 18c-3.9 0-7.5-1.2-10.4-3.3l25.1-25.1C42.8 18.5 44 22.1 44 26c0 9.9-8.1 18-18 18z"
      />
    </svg>
  );
}
export default SvgError;
