import * as React from 'react';
function SvgCall(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M48.5 37.9L42.4 33c-1.4-1.1-3.4-1.2-4.8-.1l-5.2 3.8c-.6.5-1.5.4-2.1-.2l-7.8-7-7-7.8c-.6-.6-.6-1.4-.2-2.1l3.8-5.2c1.1-1.4 1-3.4-.1-4.8l-4.9-6.1c-1.5-1.8-4.2-2-5.9-.3L3 8.4c-.8.8-1.2 1.9-1.2 3 .5 10.2 5.1 19.9 11.9 26.7S30.2 49.5 40.4 50c1.1.1 2.2-.4 3-1.2l5.2-5.2c1.9-1.5 1.8-4.3-.1-5.7z"
      />
    </svg>
  );
}
export default SvgCall;
