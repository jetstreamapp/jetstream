import * as React from 'react';
function SvgBack(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M48.6 23H15.4c-.9 0-1.3-1.1-.7-1.7l9.6-9.6c.6-.6.6-1.5 0-2.1l-2.2-2.2c-.6-.6-1.5-.6-2.1 0L2.5 25c-.6.6-.6 1.5 0 2.1L20 44.6c.6.6 1.5.6 2.1 0l2.1-2.1c.6-.6.6-1.5 0-2.1l-9.6-9.6c-.6-.7-.2-1.8.7-1.8h33.2c.8 0 1.5-.6 1.5-1.4v-3c0-.8-.6-1.6-1.4-1.6z"
      />
    </svg>
  );
}
export default SvgBack;
