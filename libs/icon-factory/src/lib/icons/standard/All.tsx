import * as React from 'react';
function SvgAll(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M57 44.5c-1.5 0-2.7-1.2-2.7-2.7V24.5c0-1.5 1.2-2.7 2.7-2.7h17.6c1.5 0 2.7 1.2 2.7 2.7v17.3c0 1.5-1.2 2.7-2.7 2.7H57zM64.6 54.7L54.3 65.8c-.6.6-.6 1.7 0 2.3l10.3 11.1c.7.7 1.8.7 2.5 0l10.3-11.1c.6-.6.6-1.7 0-2.3L67.1 54.7c-.7-.7-1.9-.7-2.5 0z"
      />
      <circle fill="unset" cx={33.8} cy={66.6} r={11.6} />
      <path
        fill="unset"
        d="M23.6 25.7l8.9-5.1c.8-.5 1.8-.5 2.7 0l8.9 5.1c.8.5 1.3 1.4 1.3 2.3v10.2c0 .9-.5 1.8-1.3 2.3l-8.9 5.1c-.8.5-1.8.5-2.7 0l-8.9-5.1c-.8-.5-1.4-1.4-1.4-2.3V28c0-1 .6-1.9 1.4-2.3z"
      />
    </svg>
  );
}
export default SvgAll;
