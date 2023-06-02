import * as React from 'react';
function SvgPage(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M44.4 19H33.2c-2.6 0-4.2-1.6-4.2-4.2V3.6c0-.9-.7-1.6-1.6-1.6H10.8C8.2 2 6 4.2 6 6.8v38.4c0 2.6 2.2 4.8 4.8 4.8h30.4c2.6 0 4.8-2.2 4.8-4.8V20.6c0-.9-.7-1.6-1.6-1.6z"
      />
      <path
        fill="unset"
        d="M45.7 12.9L35.1 2.3c-.2-.2-.6-.3-.9-.3-.6 0-1.2.5-1.2 1.1v8.5c0 1.8 1.6 3.4 3.4 3.4h8.5c.6 0 1.1-.6 1.1-1.2 0-.3-.1-.7-.3-.9z"
      />
    </svg>
  );
}
export default SvgPage;
