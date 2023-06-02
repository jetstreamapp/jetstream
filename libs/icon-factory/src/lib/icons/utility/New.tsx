import * as React from 'react';
function SvgNew(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M43 9C33.6-.3 18.4-.3 9 9-.3 18.4-.3 33.6 9 43c9.4 9.4 24.6 9.4 33.9 0 9.4-9.4 9.4-24.6.1-34zm-1 19c0 .6-.4 1-1 1H30c-.5 0-1 .5-1 1v11c0 .5-.5 1-1 1h-4c-.6 0-1-.4-1-1V30c0-.6-.4-1-1-1H11c-.6 0-1-.4-1-1v-4c0-.5.5-1 1-1h11c.6 0 1-.4 1-1V11c0-.5.5-1 1-1h4c.5 0 1 .4 1 1v11c0 .6.4 1 1 1h11c.5 0 1 .5 1 1v4z"
      />
    </svg>
  );
}
export default SvgNew;
