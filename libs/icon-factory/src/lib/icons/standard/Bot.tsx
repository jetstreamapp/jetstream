import * as React from 'react';
function SvgBot(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M496 258c72 0 130 58 130 130v33a1133 1133 0 00-260 0v-33c0-71 58-130 130-130zm236 380l13-114c29 5 51 29 51 56 0 32-29 58-64 58zm-473 0c-35 0-64-26-64-58 0-28 22-51 51-56zm428-189a1794 1794 0 00-380 0c-22 2-38 22-35 43l20 194c2 18 16 33 35 35a1378 1378 0 00342 0c18-2 33-17 35-35l20-194c0-22-15-41-37-43zM386 625c-16 0-28-16-28-37s13-37 28-37 28 16 28 37-12 37-28 37zm167 41l-2 5-5 2h-99l-5-2-2-5v-18c0-4 3-7 7-7h2c4 0 7 3 7 7v9h81v-9c0-4 3-7 7-7h2c4 0 7 3 7 7zm53-41c-16 0-28-16-28-37s13-37 28-37 28 16 28 37-12 37-28 37z" />
    </svg>
  );
}
export default SvgBot;
