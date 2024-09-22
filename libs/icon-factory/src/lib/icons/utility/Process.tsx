import * as React from 'react';
function SvgProcess(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M162 232l85-106c6-8 18-8 24 0l85 107c3 4 7 7 12 7h96c8 0 16-7 16-15V80c0-22-19-40-41-40H80a40 40 0 00-40 40v145c0 8 7 15 15 15h95c5 0 9-4 12-8zm195 56l-85 106c-6 8-18 8-24 0l-85-107c-4-3-8-7-13-7H55c-8 0-15 7-15 15v145a40 40 0 0040 40h360a40 40 0 0040-40V295c0-8-7-15-15-15h-96c-5 0-9 4-12 8z" />
    </svg>
  );
}
export default SvgProcess;
