import * as React from 'react';
function SvgTask(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M46.6 23.7l-2.1-2.1c-.6-.6-1.5-.6-2.1 0L29.2 34.8l-5.3-5.3c-.6-.6-1.5-.6-2.1 0l-2.1 2.1c-.6.6-.6 1.5 0 2.1l7.4 7.4c.6.6 1.4.9 2.1.9.8 0 1.5-.3 2.1-.9l15.3-15.3c.5-.5.5-1.5 0-2.1zM77 38H51c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2h26c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2zM77 56H45c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2h32c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2zM33 56h-4c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2zM33 74h-4c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2zM77 74H45c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2h32c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2z"
      />
    </svg>
  );
}
export default SvgTask;
