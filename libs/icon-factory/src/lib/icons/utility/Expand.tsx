import * as React from 'react';
function SvgExpand(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M488 20H333c-10 0-13 9-5 17l49 49-90 90c-5 5-5 13 0 19l37 37c5 5 13 5 19 0l91-91 49 49c8 8 17 5 17-5V31c0-6-6-11-12-11zM35 500h154c10 0 13-11 5-19l-49-50 90-91c5-5 5-14 0-19l-37-37c-5-5-13-5-19 0l-90 90-50-49c-9-8-19-5-19 5v154c0 7 8 16 15 16zm465-12V333c0-10-9-13-17-5l-49 49-90-90c-5-5-13-5-19 0l-37 37c-5 5-5 13 0 19l91 91-49 49c-8 8-5 17 5 17h154c6 0 11-6 11-12zM20 35v154c0 10 11 13 19 5l50-49 91 90c5 5 14 5 19 0l37-37c5-5 5-13 0-19l-90-90 49-50c8-9 5-19-5-19H36c-7 0-16 8-16 15z" />
    </svg>
  );
}
export default SvgExpand;
