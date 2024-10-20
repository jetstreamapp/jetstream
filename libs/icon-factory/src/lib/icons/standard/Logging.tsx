import * as React from 'react';
function SvgLogging(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M772 562h-37c-10 0-18 10-18 18v123c0 10-9 18-18 18H293c-10 0-18-9-18-18V580c0-9-9-18-18-18h-37c-10 0-18 10-18 18v166c0 27 22 49 49 49h491c27 0 49-22 49-49V580c-1-9-9-18-19-18zM508 210c-7-7-18-7-26 0L316 376c-7 7-7 18 0 26l26 26c7 7 18 7 26 0l69-69c7-7 22-2 22 9v260c0 10 7 18 17 18h37c10 0 20-10 20-18V369c0-11 12-16 21-9l69 69c7 7 18 7 26 0l26-26c7-7 7-18 0-26-2 0-167-167-167-167z" />
    </svg>
  );
}
export default SvgLogging;
