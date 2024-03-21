import * as React from 'react';
function SvgLightningUsage(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M19 73.9c0 2.8 2.2 5 5 5h53c1.1 0 2-.9 2-2v-2.1c0-1.1-.9-2-2-2H26.9c-1 0-1.9-.9-1.9-1.9v-50c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v53z"
      />
      <path
        fill="unset"
        d="M34.4 57.9c-.8 0-1.5-.3-2.1-.9-1.2-1.2-1.2-3.1 0-4.2l16-15.9c1.2-1.2 3.1-1.2 4.2 0l7.7 7.7 13.5-13.7c1.2-1.2 3.1-1.2 4.2 0 1.2 1.2 1.2 3.1 0 4.2L62.4 50.8c-.6.6-1.3.9-2.1.9s-1.6-.3-2.1-.9l-7.8-7.7L36.6 57c-.6.6-1.4.9-2.2.9z"
      />
    </svg>
  );
}
export default SvgLightningUsage;
