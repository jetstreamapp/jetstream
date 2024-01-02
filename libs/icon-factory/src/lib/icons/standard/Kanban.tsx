import * as React from 'react';
function SvgKanban(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M56.5 38.3c0-1-.9-1.9-1.9-1.9H43.4c-1 0-1.9.9-1.9 1.9V72c0 1 .9 1.9 1.9 1.9h11.2c1 0 1.9-.9 1.9-1.9V38.3zm-22.5 0c0-1-.9-1.9-1.9-1.9H20.9c-1 0-1.9.9-1.9 1.9V77c0 1 .9 1.9 1.9 1.9h11.2c1 0 1.9-.9 1.9-1.9V38.3zm45 0c0-1-.9-1.9-1.9-1.9H65.9c-1 0-1.9.9-1.9 1.9V67c0 1 .9 1.9 1.9 1.9h11.2c1 0 1.9-.9 1.9-1.9V38.3zm0-17.5c0-1-.9-1.9-1.9-1.9H20.9c-1 0-1.9.9-1.9 1.9V27c0 1 .9 1.9 1.9 1.9h56.2c1 0 1.9-.9 1.9-1.9v-6.2z"
      />
    </svg>
  );
}
export default SvgKanban;
