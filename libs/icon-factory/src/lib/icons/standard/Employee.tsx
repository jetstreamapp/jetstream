import * as React from 'react';
function SvgEmployee(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M721 467c-30-138-177-239-206-259l-4-2a33 33 0 00-24 0l-2 1c-29 19-175 120-206 258a222 222 0 0044 191 245 245 0 00147 90l-15 26a25 25 0 000 17 17 17 0 0015 9h61a20 20 0 0015-9 25 25 0 000-17l-15-26a240 240 0 00147-90 223 223 0 0043-189zm-83 157l-17 19a130 130 0 00-120-80h-4a123 123 0 00-117 80l-17-19a174 174 0 01-35-147c24-106 133-192 172-218 39 27 148 113 172 219a166 166 0 01-34 146z" />
      <circle cx={500} cy={463} r={84} />
    </svg>
  );
}
export default SvgEmployee;
