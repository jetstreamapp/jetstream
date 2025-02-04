import * as React from 'react';
function SvgSubMetric(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M73.6 22.8c1.3-.5 2.7.3 3 1.6L80.1 38c.5 1.9-1.5 3.6-3.3 2.6l-4.2-2.2-14.3 26.7c-.7 1.3-2 2.2-3.5 2.4-1.5.2-3-.4-4-1.5l-9.4-10.7-12.1 18-.8 1.3c-1 1.4-2.9 1.8-4.3.8l-2.6-1.7c-1.4-1-1.8-2.9-.8-4.3l1.7-2.6v-.1l14.6-21.6c.8-1.2 2.1-1.9 3.5-2 1.4 0 2.8.5 3.8 1.6l9 10.2 11.1-20.7-4.4-2.3c-1.8-.9-1.6-3.5.3-4.2l13.2-4.8v-.1z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgSubMetric;
