import * as React from 'react';
function SvgNotebook(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" fill="unset" aria-hidden="true" {...props}>
      <path d="M44 2H14a4 4 0 00-4 4v3H7c-1.7 0-3 1.3-3 3s1.3 3 3 3h3v8H7c-1.7 0-3 1.3-3 3s1.3 3 3 3h3v8H7c-1.7 0-3 1.3-3 3s1.3 3 3 3h3v3a4 4 0 004 4h30a4 4 0 004-4V6a4 4 0 00-4-4zm-7 34c0 .6-.4 1-1 1H22c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h14c.6 0 1 .4 1 1zm2-8c0 .6-.4 1-1 1H20c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h18c.6 0 1 .4 1 1zm2-10c0 .6-.4 1-1 1H18c-.6 0-1-.4-1-1v-6c0-.6.4-1 1-1h22c.6 0 1 .4 1 1z" />
    </svg>
  );
}
export default SvgNotebook;
