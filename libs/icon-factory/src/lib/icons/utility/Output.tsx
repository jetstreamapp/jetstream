import * as React from 'react';
function SvgOutput(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M45.95 23.99H34.38s-1.28 0-1.28 1.31v1.39c0 .29.04.55.19.79.24.37.66.52 1.09.52H44v5.99H26L8 34v-6h9.62c.42 0 .85-.14 1.09-.51.16-.24.19-.51.19-.79v-1.38c0-1.31-1.28-1.31-1.28-1.31H6.05c-1.13 0-2.05.91-2.05 2.05v-.02 22.24c0 .94.77 1.71 1.71 1.71h20.35l20.22-.01c.94 0 1.71-.77 1.71-1.71V26.03c0-1.13-.91-2.05-2.05-2.05z"
        fill="unset"
      />
      <path
        d="M16.43 15.92h6.7v12.5c0 .8.7 1.5 1.5 1.5h3c.8 0 1.5-.7 1.5-1.5v-12.5h6.89c1 0 1.5-.9.9-1.4l-9.99-12.3c-.4-.3-1-.3-1.4 0l-10 12.29c-.6.6-.1 1.4.9 1.4z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgOutput;
