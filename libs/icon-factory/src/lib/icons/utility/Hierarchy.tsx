import * as React from 'react';
function SvgHierarchy(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M23.1 23H10.8c-.7 0-1.4.6-1.4 1.3v10.5H5.3c-.7 0-1.4.7-1.4 1.4v10c0 .7.7 1.4 1.4 1.4H19c.7 0 1.4-.7 1.4-1.4v-10c0-.7-.7-1.4-1.4-1.4h-4.1v-6.4h21.9v6.4h-4.1c-.7 0-1.4.7-1.4 1.4v10c0 .7.7 1.4 1.4 1.4h13.7c.7 0 1.3-.7 1.3-1.4v-10c0-.7-.6-1.4-1.3-1.4h-4.2V24.3c0-.7-.7-1.3-1.4-1.3H28.6v-6.4h4.1c.7 0 1.3-.7 1.3-1.4v-10c0-.7-.6-1.4-1.3-1.4H19c-.7 0-1.4.7-1.4 1.4v10c0 .7.7 1.4 1.4 1.4h4.2V23z"
      />
    </svg>
  );
}
export default SvgHierarchy;
