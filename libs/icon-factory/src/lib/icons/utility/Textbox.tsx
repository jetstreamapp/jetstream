import * as React from 'react';
function SvgTextbox(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M48 41c1.1 0 2-.9 2-2V13c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v26c0 1.1.9 2 2 2h44zM6 37V15h40v22H6zm5.4-6.9h1.7c.2 0 .5-.2.6-.5L15 26h5.5l1.4 3.6c0 .2.3.5.6.5h1.7c.3 0 .5-.3.4-.5l-4.9-12.2c0-.2-.3-.4-.5-.4h-2.9c-.2 0-.5.2-.6.4l-4.5 12.2c-.1.2 0 .5.3.5h-.1zm6.1-10.6h.4l1.8 4.1H16l1.6-4.1h-.1zm9.6 13.1H8.6c-.3 0-.6.3-.6.6v1.2c0 .3.3.6.6.6h18.5c.3 0 .6-.3.6-.6v-1.2c0-.3-.3-.6-.6-.6z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgTextbox;
