import * as React from 'react';
function SvgTeamMember(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M570 440H450c-33 0-60 27-60 60v90c0 11 5 21 12 28s17 12 28 12v90c0 33 27 60 60 60h40c33 0 60-27 60-60v-90c11 0 21-4 28-12 7-7 12-17 12-28v-90c0-33-27-60-60-60zM366 667l-7-6c-19-20-30-45-30-71v-90c0-32 13-62 34-83 6-6 1-17-7-17h-96c-33 0-60 27-60 60v90c0 11 5 21 12 28s17 12 28 12v90c0 33 27 60 60 60h40c9 0 17-2 24-5 4-2 6-5 6-9v-51c0-3-1-6-4-8zm394-267h-96c-9 0-13 10-7 17 21 22 34 51 34 83v90c0 26-10 51-30 71l-7 6c-2 2-4 5-4 8v51c0 4 2 8 6 9 7 3 15 5 24 5h40c33 0 60-27 60-60v-90c11 0 21-4 28-12 7-7 12-17 12-28v-90c0-33-27-60-60-60z" />
      <circle cx={510} cy={330} r={70} />
      <circle cx={320} cy={290} r={70} />
      <circle cx={700} cy={290} r={70} />
    </svg>
  );
}
export default SvgTeamMember;
