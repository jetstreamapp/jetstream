import * as React from 'react';
function SvgTextarea(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M74 80H26c-3.3 0-6-2.7-6-6V26c0-3.3 2.7-6 6-6h48c3.3 0 6 2.7 6 6v48c0 3.3-2.7 6-6 6zM28.1 30v40c0 1.1.9 2 2 2H70c1.1 0 2-.9 2-2V30c0-1.1-.9-2-2-2H30.1c-1.1 0-2 .9-2 2z"
      />
      <path
        fill="unset"
        d="M61.9 51.2c1 0 2 .9 2 2v8.7c0 1.1-.9 2-2 2h-9.2c-1.1 0-2-.9-2-2 0-.7.3-1.3.8-1.8l1.9-1.9c1.3-1.2 2.7-2.4 4-3.6.9-.8 1.8-1.7 2.8-2.5.3-.2.5-.5.8-.6.3-.2.6-.3.9-.3z"
      />
    </svg>
  );
}
export default SvgTextarea;
