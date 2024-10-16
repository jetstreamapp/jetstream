import * as React from 'react';
function SvgAttributeBasedPricing(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <g transform="scale(10)">
        <path d="M65 21.1a1 1 0 011.8 0L79.5 43a1 1 0 01-.9 1.5H53.3a1 1 0 01-1-1.5l12.8-21.9zM45.4 51.5H34.9c-.6 0-1.2.3-1.7.8L20.4 65c-1 1-1 2.9 0 4l10.1 10.1c1.1 1.1 3 1.1 4 0l13-13a2 2 0 00.7-1.8v-10c0-1.6-1.3-3-2.8-3zM35 72.5l-.7.7a1 1 0 01-1.3 0l-6.5-6.5a1 1 0 010-1.4l.7-.6a1 1 0 011.3 0l6.5 6.4c.3.4.3 1 0 1.4zm3.8-3.8l-.7.6a1 1 0 01-1.3 0L30.4 63a1 1 0 010-1.4l.7-.7a1 1 0 011.3 0l6.5 6.5c.4.4.4 1 0 1.4zm2.6-8.1c-1.3 0-2.3-1.1-2.3-2.4s1-2.4 2.3-2.4a2.4 2.4 0 110 4.8z" />
        <rect width={23.9} height={23.9} x={20.6} y={20.6} rx={2} />
      </g>
      <circle cx={664} cy={674} r={130} />
    </svg>
  );
}
export default SvgAttributeBasedPricing;
