import * as React from 'react';
function SvgUnmatched(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M65.7 46.8c-.1-.5-.5-.8-1-.8H35.3c-.5 0-.9.3-1 .8-.2 1-.3 2.1-.3 3.2s.1 2.2.3 3.2c.1.5.5.8 1 .8h29.4c.5 0 .9-.3 1-.8.2-1 .3-2.1.3-3.2s-.1-2.2-.3-3.2z"
      />
      <path
        fill="unset"
        d="M50 20c-16.5 0-30 13.5-30 30s13.5 30 30 30 30-13.5 30-30-13.5-30-30-30zm0 52c-12.1 0-22-9.9-22-22s9.9-22 22-22 22 9.9 22 22-9.9 22-22 22z"
      />
    </svg>
  );
}
export default SvgUnmatched;
