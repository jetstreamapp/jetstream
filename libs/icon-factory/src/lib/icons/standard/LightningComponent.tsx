import * as React from 'react';
function SvgLightningComponent(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M611 200H442c-25 0-47 15-56 38L281 509c-8 20 7 41 28 41h172l-64 224c-6 21 20 35 34 18l263-312c17-19 3-50-23-50H561l114-184c12-20-2-46-26-46z" />
    </svg>
  );
}
export default SvgLightningComponent;
