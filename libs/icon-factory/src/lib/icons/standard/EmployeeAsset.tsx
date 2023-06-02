import * as React from 'react';
function SvgEmployeeAsset(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M74.8 20.3H25.2a5 5 0 00-5 5v34.3a5 5 0 005 5h49.5a5 5 0 005-5V25.2a4.91 4.91 0 00-4.9-4.9zm-2.5 34.9a2 2 0 01-1.9 1.9H29.6a1.9 1.9 0 01-1.9-1.9V29.6a2 2 0 011.9-1.9h40.7a2 2 0 012 1.9zM41.3 72.3a5 5 0 00-5 5v.6a2 2 0 001.9 1.9h23.5a2 2 0 001.9-1.9v-.6a5 5 0 00-5-5z"
        fill="unset"
      />
      <circle cx={50.1} cy={37.6} r={5.8} fill="unset" />
      <path d="M50.2 44.4h-.4a8.83 8.83 0 00-8.7 7.5c0 .4.1 1.2 1.5 1.2h14.9c1.4 0 1.5-.9 1.5-1.2a9 9 0 00-8.8-7.5z" fill="unset" />
    </svg>
  );
}
export default SvgEmployeeAsset;
