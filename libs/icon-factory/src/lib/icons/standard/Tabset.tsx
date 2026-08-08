import * as React from 'react';
function SvgTabset(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M330 200c17 0 30 13 30 30v120c0 17 13 30 30 30h380c17 0 30 13 30 30v330c0 33-27 60-60 60H260c-33 0-60-27-60-60V230c0-17 13-30 30-30zm90 30c0-17 13-30 30-30h100c17 0 30 13 30 30v60c0 17-13 30-30 30H450c-17 0-30-13-30-30zm220 0c0-17 13-30 30-30h100c17 0 30 13 30 30v60c0 17-13 30-30 30H670c-17 0-30-13-30-30z" />
    </svg>
  );
}
export default SvgTabset;
