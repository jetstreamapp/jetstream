import * as React from 'react';
function SvgShortcuts(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M12.1 2.7h26.5c.9 0 1.6.7 1.6 1.6 0 .5-.2.9-.5 1.2l-7.2 7.2c4.4 3.9 16.7 17.5 2.3 34.9l-.2.2c0 .1-.1.1-.2.2-.3.4-.8.7-1.4.7-.9 0-1.6-.7-1.6-1.6v-.2-.1c0-.1 0-.2.1-.2.5-2.2 3.6-17.2-9.6-23.4l-8.7 8.7c-.3.3-.7.5-1.1.5-.9 0-1.6-.7-1.6-1.6V4.4c-.1-.9.7-1.7 1.6-1.7z"
      />
    </svg>
  );
}
export default SvgShortcuts;
