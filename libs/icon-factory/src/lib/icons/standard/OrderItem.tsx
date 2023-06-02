import * as React from 'react';
function SvgOrderItem(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M21.2 51.9L48 64.6c1.2.6 2.7.6 3.9 0l26.9-12.7c1.6-.8 1.6-2.9 0-3.7L51.9 35.5c-1.2-.6-2.7-.6-3.9 0L21.2 48.3c-1.7.7-1.7 2.9 0 3.6z"
      />
    </svg>
  );
}
export default SvgOrderItem;
