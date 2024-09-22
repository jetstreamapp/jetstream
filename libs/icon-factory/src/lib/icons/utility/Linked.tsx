import * as React from 'react';
function SvgLinked(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M173 361l-11-14s-7-10-9-16a10 10 0 00-9-5h-6a66 66 0 01-67-60 65 65 0 0165-69h91a80 80 0 0132 8c12 7 22 18 27 31 3 8 5 16 5 26l-2 14c-2 7 3 13 10 12h34c5 0 8-4 10-8l1-18a122 122 0 00-20-65 116 116 0 00-96-52h-88c-63 0-117 49-119 112-3 66 50 121 116 121h30c7-1 11-11 6-17zm326-105a117 117 0 00-119-112l-27-1c-8 0-13 10-8 16 8 9 14 19 20 30 2 3 5 5 9 5h6c35 0 65 26 67 60a65 65 0 01-65 69h-91a80 80 0 01-32-8 63 63 0 01-27-31 70 70 0 01-5-26l2-14c2-7-3-13-10-12h-34c-5 0-8 4-10 8l-1 18a115 115 0 0084 111c10 3 22 5 32 5h91c67 3 120-52 118-118z" />
    </svg>
  );
}
export default SvgLinked;
