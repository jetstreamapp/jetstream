import * as React from 'react';
function SvgMetric(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="unset" aria-hidden="true" {...props}>
      <path d="M72 22H28a6 6 0 00-6 6v44a6 6 0 006 6h44a6 6 0 006-6V28a6 6 0 00-6-6m-4.5 21.6l-2.7-1.4-9.3 17.4c-.5.8-1.3 1.5-2.3 1.6-.9 0-2-.3-2.6-1l-6.1-6.9L36.6 65l-.6.8c-.7.9-1.9 1.1-2.8.6l-1.7-1.1a2.2 2.2 0 01-.6-2.8l1.1-1.7 9.4-14c.6-.7 1.4-1.2 2.3-1.3.9 0 1.9.3 2.4 1l5.8 6.6 7.2-13.5-2.8-1.5c-1.1-.7-1-2.3.2-2.7l8.6-3.1.3-.3c.8-.3 1.8.2 2 1l2.2 8.9c.3 1.3-1 2.3-2.2 1.7z" />
    </svg>
  );
}
export default SvgMetric;
