import * as React from 'react';
function SvgReplace(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M42.4 64.3c0-1-.9-1.9-1.9-1.9H21.8c-1 0-1.9.9-1.9 1.9V78c0 1 .9 1.9 1.9 1.9h18.7c1 0 1.9-.9 1.9-1.9V64.3zM27.7 45h-6.1c-1.2 0-1.9 1.1-1.1 1.7l10 10.3c.5.4 1.2.4 1.7 0l10-10.3c.7-.7 0-1.7-1.1-1.7h-5.9c0-6.2 6.1-12.5 12.3-12.5V25c-11.2 0-19.8 8.7-19.8 19.9v.1zm41.9-2.1c-.5-.4-1.2-.4-1.7 0l-10 10.3c-.7.7 0 1.7 1.1 1.7h6c0 7.5-5.1 12.5-12.6 12.5v7.5c11.2 0 20.1-8.7 20.1-19.9h6.1c1.2 0 1.9-1.1 1.1-1.7L69.6 43v-.1zm10.2-20.8c0-1-.9-1.9-1.9-1.9H59.2c-1 0-1.9.9-1.9 1.9v13.7c0 1 .9 1.9 1.9 1.9h18.7c1 0 1.9-.9 1.9-1.9V22.1z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgReplace;
