import * as React from 'react';
function SvgScreen(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M80 25c0-2.8-2.2-5-5-5H25c-2.8 0-5 2.2-5 5v34.7c0 2.8 2.2 5 5 5h50c2.8 0 5-2.2 5-5V25zm-7.5 30.3c0 1-.9 1.9-1.9 1.9H29.4c-1 0-1.9-.9-1.9-1.9V29.4c0-1 .9-1.9 1.9-1.9h41.2c1 0 1.9.9 1.9 1.9v25.9zM41.2 72.5c-2.8 0-5 2.2-5 5v.6c0 1 .9 1.9 1.9 1.9h23.8c1 0 1.9-.9 1.9-1.9v-.6c0-2.8-2.2-5-5-5H41.2z"
      />
      <path
        fill="unset"
        d="M40.2 50.9h-5.6c-.5 0-1-.5-1-1V34.7c0-.6.5-1 1-1h5.6c.5 0 1 .4 1 1v15.2c0 .5-.5 1-1 1zM65.4 50.9H48.3c-.5 0-1-.5-1-1V34.7c0-.5.5-1 1-1h17.1c.5 0 1 .5 1 1v15.2c0 .6-.5 1-1 1z"
      />
    </svg>
  );
}
export default SvgScreen;
