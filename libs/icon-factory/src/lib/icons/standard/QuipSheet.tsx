import * as React from 'react';
function SvgQuipSheet(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M31.9 38.8h-10c-1 0-1.9.9-1.9 1.9v31.9c0 2.8 2.2 5 5 5h6.9c1 0 1.9-.9 1.9-1.9v-35c0-1.1-.9-1.9-1.9-1.9zm46.2 0H40.6c-1 0-1.9.9-1.9 1.9v35c0 1 .9 1.9 1.9 1.9H75c2.8 0 5-2.2 5-5v-32c0-1-.9-1.8-1.9-1.8zM75 22.5H25c-2.8 0-5 2.2-5 5v4.4c0 1 .9 1.9 1.9 1.9h56.2c1 0 1.9-.9 1.9-1.9v-4.4c0-2.7-2.2-5-5-5z"
      />
    </svg>
  );
}
export default SvgQuipSheet;
