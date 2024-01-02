import * as React from 'react';
function SvgFullWidthView(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M48.5 4h-45C2.7 4 2 4.7 2 5.5v5c0 .8.7 1.5 1.5 1.5h45c.8 0 1.5-.7 1.5-1.5v-5c-.1-.8-.7-1.5-1.5-1.5zM10.7 16h-7c-.8 0-1.5.7-1.5 1.5v29.8c0 .8.7 1.5 1.5 1.5h7c.8 0 1.5-.7 1.5-1.5V17.5c0-.8-.7-1.5-1.5-1.5zM48.5 16h-7c-.8 0-1.5.7-1.5 1.5v29.8c0 .8.7 1.5 1.5 1.5h7c.8 0 1.5-.7 1.5-1.5V17.5c0-.8-.7-1.5-1.5-1.5zM34.5 16H17.7c-.8 0-1.5.7-1.5 1.5v29.8c0 .8.7 1.5 1.5 1.5h16.8c.8 0 1.5-.7 1.5-1.5V17.5c0-.8-.7-1.5-1.5-1.5z" />
      </g>
    </svg>
  );
}
export default SvgFullWidthView;
