import * as React from 'react';
function SvgEnter(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M44 30.5s.1 1.6-1.5 1.6H15.2c-.9 0-1.3-1.2-.7-1.8l5.6-5.6c.6-.6.6-1.5 0-2.1L18 20.5c-.6-.6-1.5-.6-2.1 0L2.4 34c-.6.6-.6 1.5 0 2.1L16 49.6c.6.6 1.5.6 2.1 0l2.1-2.1c.6-.6.6-1.5 0-2.1l-5.6-5.6c-.6-.7-.2-1.7.7-1.7h33.2c.7 0 1.5-.8 1.5-1.6v-33c0-.7-.7-1.5-1.5-1.5h-3c-.8 0-1.5.8-1.5 1.5v27z"
      />
    </svg>
  );
}
export default SvgEnter;
