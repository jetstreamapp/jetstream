import * as React from 'react';
function SvgLightningComponent(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M61.1 20H44.2c-2.5 0-4.7 1.5-5.6 3.8L28.1 50.9c-.8 2 .7 4.1 2.8 4.1h17.2l-6.4 22.4c-.6 2.1 2 3.5 3.4 1.8L71.4 48c1.7-1.9.3-5-2.3-5h-13l11.4-18.4c1.2-2-.2-4.6-2.6-4.6h-3.8z"
      />
    </svg>
  );
}
export default SvgLightningComponent;
