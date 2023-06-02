import * as React from 'react';
function SvgSalesPath(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M15.2 68.2L29.4 51c.4-.7.4-1.5 0-2.1l-14.2-17c-.1-.2-.2-.4-.2-.6 0-.6.5-1 1-1h20.7c.6 0 1.1.2 1.4.7L53 49c.4.6.4 1.4 0 2.1l-14.8 18c-.3.4-.9.7-1.4.7H16.1c-.6 0-1-.4-1-1-.1-.2 0-.5.1-.6z"
      />
      <path
        fill="unset"
        d="M46.8 68.2L60.9 51c.4-.7.4-1.5 0-2.1l-14.2-17c-.1-.2-.2-.4-.2-.6 0-.6.5-1 1-1h20.7c.6 0 1.1.2 1.4.7l14.9 18c.4.6.4 1.4 0 2.1l-14.8 18c-.3.4-.9.7-1.4.7H47.6c-.6 0-1-.4-1-1 0-.2.1-.5.2-.6z"
      />
    </svg>
  );
}
export default SvgSalesPath;
