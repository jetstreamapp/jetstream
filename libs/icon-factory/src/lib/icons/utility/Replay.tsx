import * as React from 'react';
function SvgReplay(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M365 127h7c10 0 10-7 4-13l-48-48c-6-5-6-15 0-21l21-21c4-6 14-6 20 0l127 127c5 5 5 13 0 18L368 297c-6 5-13 5-18-1l-22-22c-6-5-7-14-1-20l48-48c7-7 9-13 1-17l-11-1H206c-70 0-126 56-126 126s56 126 126 126h108c69 0 124-55 126-123v-4c1-7 4-14 9-19l37-37c5-5 14-1 14 6v59l-1 4c-6 96-85 172-183 174H206a186 186 0 110-372z" />
    </svg>
  );
}
export default SvgReplay;
