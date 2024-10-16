import * as React from 'react';
function SvgProfile(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M271 27a19 19 0 00-22 0C164 91 85 151 85 267a169 169 0 0047 123l7 7a179 179 0 00106 42l-18 31s-20 27 27 27h12c47 0 26-27 26-27l-17-31a179 179 0 00106-42c35-31 54-76 54-129 0-117-79-177-164-241zm101 324a97 97 0 01-10 11 108 108 0 00-202-5 102 102 0 01-15-17 150 150 0 01-19-108c12-67 61-110 134-166 86 65 137 114 137 201a137 137 0 01-25 84z" />
      <circle cx={260} cy={207} r={62} />
    </svg>
  );
}
export default SvgProfile;
