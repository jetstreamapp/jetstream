import * as React from 'react';
function SvgPrepFlow(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="unset" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M32.6 43.3A9 9 0 1129 26a9 9 0 018.8 7H50v-3a4 4 0 014-4h22a4 4 0 014 4v10a4 4 0 01-4 4H54a4 4 0 01-4-4v-1H37.1c2.3 4 2.9 7 3.6 10.7l.7 3.1v.2c.4 1.5 1 3.8 2.4 5.9 1.1 1.6 3 3.2 6.2 3.5V60a4 4 0 014-4h22a4 4 0 014 4v10a4 4 0 01-4 4H54a4 4 0 01-4-4v-1.6c-5.4-.4-9-3-11.1-6a20 20 0 01-3.3-8v-.2l-.8-3.5c-.6-3-1-5-2.2-7.5z"
      />
    </svg>
  );
}
export default SvgPrepFlow;
