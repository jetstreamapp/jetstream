import * as React from 'react';
function SvgAll(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M31.6 21.6c-1.2 0-2.2-1-2.2-2.2V5.5c0-1.2 1-2.2 2.2-2.2h14.2c1.2 0 2.2 1 2.2 2.2v13.9c0 1.2-1 2.2-2.2 2.2H31.6zM37.7 29.8l-8.2 8.9c-.5.5-.5 1.3 0 1.9l8.2 8.9c.5.6 1.5.6 2 0l8.2-8.9c.5-.5.5-1.3 0-1.9l-8.2-8.9c-.5-.6-1.4-.6-2 0z"
      />
      <circle fill="unset" cx={13} cy={39.4} r={9.3} />
      <path
        fill="unset"
        d="M4.8 6.5L12 2.4c.7-.4 1.5-.4 2.1 0l7.1 4.1c.7.4 1.1 1.1 1.1 1.9v8.2c0 .8-.4 1.5-1.1 1.9l-7.1 4.1c-.7.4-1.5.4-2.1 0l-7.2-4.1c-.7-.4-1.1-1.1-1.1-1.9V8.4c0-.8.4-1.5 1.1-1.9z"
      />
    </svg>
  );
}
export default SvgAll;
