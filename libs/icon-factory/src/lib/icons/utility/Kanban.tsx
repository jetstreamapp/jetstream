import * as React from 'react';
function SvgKanban(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M32 17.5c0-.8-.7-1.5-1.5-1.5h-9c-.8 0-1.5.7-1.5 1.5v27c0 .8.7 1.5 1.5 1.5h9c.8 0 1.5-.7 1.5-1.5v-27zM14 17.5c0-.8-.7-1.5-1.5-1.5h-9c-.8 0-1.5.7-1.5 1.5v31c0 .8.7 1.5 1.5 1.5h9c.8 0 1.5-.7 1.5-1.5v-31zM50 17.5c0-.8-.7-1.5-1.5-1.5h-9c-.8 0-1.5.7-1.5 1.5v23c0 .8.7 1.5 1.5 1.5h9c.8 0 1.5-.7 1.5-1.5v-23zM50 3.5c0-.8-.7-1.5-1.5-1.5h-45C2.7 2 2 2.7 2 3.5v5c0 .8.7 1.5 1.5 1.5h45c.8 0 1.5-.7 1.5-1.5v-5z"
      />
    </svg>
  );
}
export default SvgKanban;
