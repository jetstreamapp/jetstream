import * as React from 'react';
function SvgFile(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M9.7 36.1V11.3c-2.6 0-4.7 2.1-4.7 4.6v29.4C5 47.9 7.1 50 9.7 50H33c2.6 0 4.7-2.1 4.7-4.6H19c-5.1 0-9.3 0-9.3-9.3z" />
        <path d="M45.4 15.9h-7.8c-2.6 0-4.7-2.1-4.7-4.6V3.5c.1-.8-.6-1.5-1.5-1.5H19c-2.6 0-4.7 2.1-4.7 4.6V36c0 2.6 2.1 4.6 4.7 4.6h23.3c2.6 0 4.7-2.1 4.7-4.6V17.5c0-.9-.7-1.6-1.6-1.6z" />
        <path d="M46.7 9.4l-7.2-7.1c-.2-.2-.4-.3-.7-.3-.6 0-1.1.5-1.1 1.1v5.1c0 1.7 1.4 3.1 3.1 3.1h5.1c.6 0 1.1-.5 1.1-1.1 0-.3-.1-.5-.3-.8z" />
      </g>
    </svg>
  );
}
export default SvgFile;
