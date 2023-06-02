import * as React from 'react';
function SvgFile(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M29 63V31c-3.3 0-6 2.7-6 6v38c0 3.3 2.7 6 6 6h30c3.3 0 6-2.7 6-6H41c-6.6 0-12 0-12-12z" />
        <path d="M75 37H65c-3.3 0-6-2.7-6-6V21c0-1.1-.9-2-2-2H41c-3.3 0-6 2.7-6 6v38c0 3.3 2.7 6 6 6h30c3.3 0 6-2.7 6-6V39c0-1.1-.9-2-2-2z" />
        <path d="M76.6 28.6l-9.2-9.2c-.3-.3-.6-.4-1-.4-.8 0-1.4.6-1.4 1.4V27c0 2.2 1.8 4 4 4h6.6c.8 0 1.4-.6 1.4-1.4 0-.4-.1-.7-.4-1z" />
      </g>
    </svg>
  );
}
export default SvgFile;
