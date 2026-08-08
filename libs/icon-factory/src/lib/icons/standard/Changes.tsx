import * as React from 'react';
function SvgChanges(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="unset" aria-hidden="true" {...props}>
      <path d="M28.8 42h15.8c.9 0 1.4.6 1.4 1.4v16c0 1 .9 2 2 2h4.1c1 0 2-1 2-2v-16c0-.8.5-1.3 1.4-1.3h15.9c1.1 0 2.1-1 2-2v-4.2c0-1-.9-2-2-2H55.5c-.9 0-1.4-.5-1.4-1.3v-16c0-1-.8-2-2-2h-4c-1 0-2 1-2 2v16c0 .8-.6 1.3-1.5 1.3H28.7c-1 0-2 1-2 2v4.2c0 1 1 2 2 2M71.5 72H28.7c-1 0-2 1-2 2v4c0 1.2 1 2.2 2 2h42.7c1 0 2-1 2-2v-4.2c0-1-1-1.8-2-1.8" />
    </svg>
  );
}
export default SvgChanges;
