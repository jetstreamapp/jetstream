import * as React from 'react';
function SvgDisplayText(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" fill="unset" aria-hidden="true" {...props}>
      <path d="M43.5 2.5H8.6a6 6 0 00-6.1 6.1v34.7a6 6 0 006.1 6.1h34.8a6 6 0 006.1-6.1V8.6a6 6 0 00-6-6.1zM10.6 12.7c0-1.1.9-2 2-2h22.9a2 2 0 012 2v2.1a2 2 0 01-2 2h-23a2 2 0 01-2-2v-2.1zm24.1 26.6a2 2 0 01-2 2h-20a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h20a2 2 0 012 2v2zM41.4 27a2 2 0 01-2 2H12.7a2 2 0 01-2-2v-2c0-1.1.9-2 2-2h26.6a2 2 0 012 2v2z" />
    </svg>
  );
}
export default SvgDisplayText;
