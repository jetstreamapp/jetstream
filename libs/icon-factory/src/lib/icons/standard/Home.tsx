import * as React from 'react';
function SvgHome(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M78.8 51.2h-6.3v27.5c0 .8-.5 1.2-1.3 1.2H58.8c-.8 0-1.3-.5-1.3-1.2V57.5h-15v21.2c0 .8-.5 1.2-1.3 1.2H28.8c-.8 0-1.3-.5-1.3-1.2V51.2h-6.3c-.5 0-1-.2-1.1-.8-.3-.5-.1-1 .3-1.4l28.8-28.8c.5-.5 1.4-.5 1.8 0L79.8 49c.4.4.4.9.3 1.4s-.8.8-1.3.8z"
      />
    </svg>
  );
}
export default SvgHome;
