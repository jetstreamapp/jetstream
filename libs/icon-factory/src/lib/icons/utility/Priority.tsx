import * as React from 'react';
function SvgPriority(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M9 3.5C9 2.7 8.3 2 7.5 2h-3C3.7 2 3 2.7 3 3.5v45c0 .8.7 1.5 1.5 1.5h3c.8 0 1.5-.7 1.5-1.5v-45zM47.5 7.7c-16 8.4-14.2-8.8-33.5-2.1-.6.2-1 .8-1 1.4v23.3c0 .7.7 1.2 1.3.9 19.2-6.4 17.2 11.2 33.9 1.8.5-.3.8-.8.8-1.3V8.5c0-.7-.8-1.2-1.5-.8z" />
      </g>
    </svg>
  );
}
export default SvgPriority;
