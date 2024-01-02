import * as React from 'react';
function SvgBack(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M48.5 22H15.3c-.9 0-1.3-1.1-.7-1.7l9.6-9.6c.6-.6.6-1.5 0-2.1L22 6.4c-.6-.6-1.5-.6-2.1 0L2.4 23.9c-.6.6-.6 1.5 0 2.1l17.5 17.5c.6.6 1.5.6 2.1 0l2.1-2.1c.6-.6.6-1.5 0-2.1l-9.6-9.6c-.6-.6-.2-1.7.7-1.7h33.2c.8 0 1.5-.7 1.5-1.5v-3c.1-.8-.6-1.5-1.4-1.5z"
      />
    </svg>
  );
}
export default SvgBack;
