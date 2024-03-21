import * as React from 'react';
function SvgFirstNonEmpty(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M55.9 49.3l22.7-22.8c.8-.8.8-2 0-2.9l-2.7-2.9c-.8-.8-2-.8-2.9 0L50.1 43.6c-.5.5-1.4.5-1.9 0l-22.8-23c-.8-.8-2-.8-2.9 0l-2.9 2.9c-.8.8-.8 2 0 2.9l22.8 22.8c.5.5.5 1.4 0 1.9L19.6 74c-.8.8-.8 2 0 2.9l2.9 2.9c.8.8 2 .8 2.9 0L48.2 57c.5-.5 1.4-.5 1.9 0l22.6 22.6c.8.8 2 .8 2.9 0l2.9-2.9c.8-.8.8-2 0-2.9L55.9 51.2c-.6-.6-.6-1.4 0-1.9z"
      />
    </svg>
  );
}
export default SvgFirstNonEmpty;
