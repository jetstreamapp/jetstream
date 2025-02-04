import * as React from 'react';
function SvgAdEventInfo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M22.4 45h26.1c1.4 0 2.3-1.8 1.4-3.1h.2L37 20.8c-.7-1.1-2.2-1.1-2.9 0L21 41.9c-.8 1.3 0 3.1 1.4 3.1zm10.7-16.2c.2-.3.5-.5.8-.5h5.6c.4 0 .6.4.4.7l-3.1 5.1c-.1.2 0 .5.3.5h3.5c.2 0 .4.3.2.5l-6.6 8.2c-.2.2-.5 0-.5-.3l1.2-5.6-.1.1c0-.2-.1-.4-.3-.4h-3.6c-.4 0-.4-.3-.4-.6l2.6-7.7z"
        fill="unset"
      />
      <rect x={20.5} y={72.1} width={59} height={7.9} rx={2} ry={2} fill="unset" />
      <rect x={20.5} y={54.4} width={59} height={7.9} rx={2} ry={2} fill="unset" />
      <rect x={55.5} y={36.8} width={24} height={7.9} rx={2} ry={2} fill="unset" />
    </svg>
  );
}
export default SvgAdEventInfo;
