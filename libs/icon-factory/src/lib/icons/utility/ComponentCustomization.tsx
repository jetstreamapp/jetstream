import * as React from 'react';
function SvgComponentCustomization(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M500 54c0-34-28-34-28-34H49c-5 1-29 3-29 30v142c1 6 6 28 30 28h422c31 0 28-27 28-27zm-9 299l-18-2a2 2 0 01-2-2l-8-19v-3l11-15c2-3 2-7-1-10l-20-20a8 8 0 00-5-2l-5 2-15 11-1 1h-1l-19-8a2 2 0 01-2-2l-2-17c0-3-1-6-5-8l-2-1h-29l-5 1c-2 2-5 5-5 8l-2 17-2 2-19 8h-1l-2-1c-5-3-9-8-15-11-1-1-2-2-5-2l-6 2-20 20c-3 3-3 7-1 10 3 5 8 9 11 15v3l-8 19-2 2-17 2c-3 0-7 2-8 6v34c2 3 5 5 8 6l17 2 2 2 8 19v3l-11 15c-2 3-2 7 1 10l20 20c2 2 3 2 6 2l5-2c5-3 9-8 15-11l2-1h1l19 8 2 2 2 18c0 5 3 7 8 7h29c5 0 7-2 8-7l2-18 2-2 19-8h1l1 1 15 11 5 2 6-2 20-20c3-3 3-7 1-10-3-5-8-9-11-15v-3l8-19 2-2 18-2c5 0 7-3 7-8v-28c0-7-2-9-7-10zm-111 68c-26 0-45-20-45-45s20-45 45-45 45 20 45 45c-1 24-21 45-45 45zM234 278c-1-16-15-18-19-18H38c-5 0-18 2-18 20v206c1 5 4 14 20 14h175c20 0 20-23 20-23v-24c0-10 2-21-4-31l-3-5-3-5c-6-9-5-20-5-31 0-10 0-21 5-30l7-12c4-6 4-14 4-21z" />
    </svg>
  );
}
export default SvgComponentCustomization;
