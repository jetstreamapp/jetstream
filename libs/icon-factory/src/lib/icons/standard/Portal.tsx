import * as React from 'react';
function SvgPortal(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M72 22H28c-3.3 0-6 2.7-6 6v44c0 3.3 2.7 6 6 6h44c3.3 0 6-2.7 6-6V28c0-3.3-2.7-6-6-6zM59 62.6c.3 1.2-.7 2.4-1.9 2.4H43c-1.3 0-2.2-1.2-1.9-2.4l3.2-11c-3.1-2.2-4.9-6.1-4.1-10.4.8-4 3.9-7.2 7.9-7.9C54.4 32 60 36.9 60 43.2c0 3.5-1.7 6.5-4.3 8.3L59 62.6z"
      />
    </svg>
  );
}
export default SvgPortal;
