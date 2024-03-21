import * as React from 'react';
function SvgLogging(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M77.2 56.2h-3.7c-1 0-1.8 1-1.8 1.8v12.3c0 1-.9 1.8-1.8 1.8H29.3c-1 0-1.8-.9-1.8-1.8V58c0-.9-.9-1.8-1.8-1.8H22c-1 0-1.8 1-1.8 1.8v16.6c0 2.7 2.2 4.9 4.9 4.9h49.1c2.7 0 4.9-2.2 4.9-4.9V58c-.1-.9-.9-1.8-1.9-1.8zM50.8 21c-.7-.7-1.8-.7-2.6 0L31.6 37.6c-.7.7-.7 1.8 0 2.6l2.6 2.6c.7.7 1.8.7 2.6 0l6.9-6.9c.7-.7 2.2-.2 2.2.9v26c0 1 .7 1.8 1.7 1.8h3.7c1 0 2-1 2-1.8V36.9c0-1.1 1.2-1.6 2.1-.9l6.9 6.9c.7.7 1.8.7 2.6 0l2.6-2.6c.7-.7.7-1.8 0-2.6-.2 0-16.7-16.7-16.7-16.7z"
      />
    </svg>
  );
}
export default SvgLogging;
