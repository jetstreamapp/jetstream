import * as React from 'react';
function SvgHelp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M28.4 38h-5c-.8 0-1.4-.6-1.4-1.4v-1.5c0-4.2 2.7-8 6.7-9.4 1.2-.4 2.3-1.1 3.2-2.1 5-6 .4-13.2-5.6-13.4-2.2-.1-4.3.7-5.9 2.2-1.3 1.2-2.1 2.7-2.3 4.4-.1.6-.7 1.1-1.5 1.1h-5c-.9 0-1.6-.7-1.5-1.6.4-3.8 2.1-7.2 4.8-9.9 3.2-3 7.3-4.6 11.7-4.5C34.9 2.2 41.7 9 42 17.3c.3 7-4 13.3-10.5 15.7-.9.4-1.5 1.1-1.5 2v1.5c0 .9-.8 1.5-1.6 1.5zM30 48.5c0 .8-.7 1.5-1.5 1.5h-5c-.8 0-1.5-.7-1.5-1.5v-5c0-.8.7-1.5 1.5-1.5h5c.8 0 1.5.7 1.5 1.5v5z"
      />
    </svg>
  );
}
export default SvgHelp;
