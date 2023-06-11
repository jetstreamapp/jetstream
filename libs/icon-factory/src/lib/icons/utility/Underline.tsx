import * as React from 'react';
function SvgUnderline(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M44.5 42h-37c-.8 0-1.5.7-1.5 1.5v3c0 .8.7 1.5 1.5 1.5h37c.8 0 1.5-.7 1.5-1.5v-3c0-.8-.7-1.5-1.5-1.5zM25.3 38C17.8 37.6 12 31.1 12 23.6V10c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2v13.7c0 4.3 3.2 8 7.5 8.3 4.7.3 8.5-3.4 8.5-8V10c0-1.1.9-2 2-2h2c1.1 0 2 .9 2 2v14c0 8-6.7 14.4-14.7 14z"
      />
    </svg>
  );
}
export default SvgUnderline;
