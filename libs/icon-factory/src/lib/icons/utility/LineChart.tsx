import * as React from 'react';
function SvgLineChart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M8 2C4.69 2 2 4.69 2 8v36c0 3.31 2.69 6 6 6h36c3.31 0 6-2.69 6-6V8c0-3.31-2.69-6-6-6H8zm30.99 12.25l.06-.06.02-.02c.76-.72 1.96-.73 2.74 0l1.46 1.37c.78.73.85 1.95.16 2.76s-.3.32-.3.32L42 19.83l-.13.13-11.22 11.88a3.19 3.19 0 01-4.47.17l-4.9-4.46-7.19 7.19-.05.05-1.41 1.41-.05.05-.03.03c-.79.7-1.99.68-2.75-.08l-1.41-1.41c-.76-.76-.78-1.96-.08-2.75s10.62-10.62 10.62-10.62a3.19 3.19 0 014.41-.1l4.84 4.41 10.58-11.21.22-.24z"
        fill="unset"
        fillRule="evenodd"
      />
    </svg>
  );
}
export default SvgLineChart;
