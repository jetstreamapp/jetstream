import * as React from 'react';
function SvgCaseMilestone(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M73 36H25.1c-3.3 0-6 2.7-6 6v32c0 3.3 2.7 6 6 6H73c3.3 0 6-2.7 6-6V42c0-3.3-2.7-6-6-6zM40.9 48.6v22c0 1-.7 1.9-1.7 1.9h-.1c-1 0-1.8-.9-1.8-1.9v-22c-.6-.6-.9-1.4-.9-2.2-.1-1.5 1-2.8 2.5-2.9s2.8 1 2.9 2.5v.5c0 .7-.3 1.5-.9 2.1zm21.5 13.8c0 .3-.2.6-.4.8-6.9 4.1-10.8-2.4-17.2-.3-.5.1-1-.1-1.2-.6V49.5c0-.4.2-.8.6-.9 6.6-2.6 10.5 4.2 17.5.2.2-.1.5-.1.6.1.1.1.1.2.1.3v13.2zM37.1 30h4c.5 0 1-.4 1-.9V26h14v3c0 .5.4 1 .9 1h4.1c.5 0 1-.4 1-.9V26c0-3.3-2.7-6-6-6h-14c-3.3 0-6 2.7-6 6v3c0 .5.4 1 .9 1h.1z"
      />
    </svg>
  );
}
export default SvgCaseMilestone;
