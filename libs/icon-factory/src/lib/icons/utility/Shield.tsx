import * as React from 'react';
function SvgShield(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M48 140h424c10 0 18-10 15-20-10-33-24-63-43-90-6-8-17-9-23-2a108 108 0 01-74 28c-30 0-57-12-77-32-6-6-16-6-22 0-20 20-47 32-77 32-28 0-54-10-74-28-7-6-18-5-23 2-19 26-34 57-43 90-1 10 7 20 17 20zm452 64c0-9-7-14-16-14H36c-9 0-16 5-16 14v3c0 150 104 274 240 293 136-19 240-143 240-292v-4z" />
    </svg>
  );
}
export default SvgShield;
