import * as React from 'react';
function SvgMetric(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M28 22c-3.31 0-6 2.69-6 6v44c0 3.31 2.69 6 6 6h44c3.31 0 6-2.69 6-6V28c0-3.31-2.69-6-6-6H28zm37.41 9.97c.83-.3 1.74.18 1.97 1.04l2.27 8.85c.32 1.26-1 2.31-2.15 1.7l-2.71-1.43-9.3 17.32c-.46.87-1.32 1.45-2.3 1.56-.98.11-1.95-.26-2.6-1l-6.11-6.95-7.89 11.71-.55.82c-.62.92-1.86 1.16-2.78.54l-1.66-1.12a2.01 2.01 0 01-.55-2.78l1.12-1.66s.03-.05.05-.07l9.46-14.04a3.013 3.013 0 014.75-.31l5.82 6.62 7.23-13.48-2.84-1.5c-1.15-.61-1.04-2.29.19-2.74l8.59-3.12z"
        fill="unset"
        fillRule="evenodd"
      />
    </svg>
  );
}
export default SvgMetric;
