import * as React from 'react';
function SvgAway(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M43 9C33.6-.3 18.4-.3 9 9S-.3 33.6 9 43s24.6 9.3 34 0 9.3-24.6 0-34zm-29.7 4.3c7-7 18.5-7 25.5 0 2.8 2.8 4.5 6.2 5 9.7H8.2c.6-3.6 2.3-7 5.1-9.7z"
      />
    </svg>
  );
}
export default SvgAway;
