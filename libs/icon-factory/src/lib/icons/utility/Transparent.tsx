import * as React from 'react';
function SvgTransparent(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M485 56l-21-21a17 17 0 00-24 3L326 152l-22-40a365 365 0 01-32-82c-1-6-4-10-10-10s-8 5-10 10l-1 8a483 483 0 01-41 100 975 975 0 01-69 112 160 160 0 00-30 111v4l-72 75a19 19 0 00-3 24l21 21a17 17 0 0024-3L482 80a17 17 0 003-24zM384 238L164 460a145 145 0 0098 39 155 155 0 0070-14c50-25 81-64 90-120a152 152 0 00-32-120 120 120 0 00-6-8z" />
    </svg>
  );
}
export default SvgTransparent;
