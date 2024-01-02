import * as React from 'react';
function SvgDisplayText(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M43.5 2.5H8.6c-3.4 0-6.1 2.7-6.1 6.1v34.7c0 3.4 2.7 6.1 6.1 6.1h34.8c3.4 0 6.1-2.7 6.1-6.1V8.6c.1-3.4-2.7-6.1-6-6.1zM10.6 12.7c0-1.1.9-2 2-2h22.9c1.1 0 2 .9 2 2v2.1c0 1.1-.9 2-2 2h-23c-1.1 0-2-.9-2-2v-2.1zm24.1 26.6c0 1.1-.9 2-2 2h-20c-1.1 0-2-.9-2-2v-2c0-1.1.9-2 2-2h20c1.1 0 2 .9 2 2v2zM41.4 27c0 1.1-.9 2-2 2H12.7c-1.1 0-2-.9-2-2v-2c0-1.1.9-2 2-2h26.6c1.1 0 2 .9 2 2v2z"
      />
    </svg>
  );
}
export default SvgDisplayText;
