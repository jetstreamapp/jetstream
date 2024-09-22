import * as React from 'react';
function SvgEdit(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M95 334l89 89c4 4 10 4 14 0l222-223c4-4 4-10 0-14l-88-88a10 10 0 00-14 0L95 321c-4 4-4 10 0 13zM361 57a10 10 0 000 14l88 88c4 4 10 4 14 0l25-25a38 38 0 000-55l-47-47a40 40 0 00-57 0zM21 482c-2 10 7 19 17 17l109-26c4-1 7-3 9-5l2-2c2-2 3-9-1-13l-90-90c-4-4-11-3-13-1l-2 2a20 20 0 00-5 9z" />
    </svg>
  );
}
export default SvgEdit;
