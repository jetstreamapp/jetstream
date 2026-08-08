import * as React from 'react';
function SvgSlackMentions(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M60 260c0-110 90-200 200-200s200 90 200 200v17c0 27-22 49-49 49s-31-14-31-31V172c0-11-9-20-20-20s-19 8-20 17c-21-19-49-31-80-31-66 0-120 54-120 120s54 120 120 120 71-17 93-44c13 18 34 30 58 30 49 0 89-40 89-89v-17c0-133-107-240-240-240S20 127 20 260s107 240 240 240 99-16 138-44c9-6 11-19 5-28s-19-11-28-5A200.6 200.6 0 0160 259zm200 80c44 0 80-36 80-80s-36-80-80-80-80 36-80 80 36 80 80 80"
      />
    </svg>
  );
}
export default SvgSlackMentions;
