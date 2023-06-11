import * as React from 'react';
function SvgSnippet(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M74.1 23.9c-12.1 0-21.3 9.4-21.3 21.4v28.8c0 1.1.9 2 2 2h22.8c1.1 0 2-.9 2-2V51.3c0-1.1-.9-2-2-2H60.8v-4c0-6.7 6.6-13.4 13.3-13.4h3.5c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2h-3.5zm-33.3 0c-12.1 0-21.3 9.4-21.3 21.4v28.8c0 1.1.9 2 2 2h22.8c1.1 0 2-.9 2-2V51.3c0-1.1-.9-2-2-2H27.6v-4c0-6.7 6.6-13.4 13.3-13.4h3.5c1.1 0 2-.9 2-2v-4c0-1.1-.9-2-2-2h-3.6z"
      />
    </svg>
  );
}
export default SvgSnippet;
