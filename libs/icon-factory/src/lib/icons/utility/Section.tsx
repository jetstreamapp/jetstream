import * as React from 'react';
function SvgSection(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M476 292h-80a24 24 0 01-24-24v-16c0-13 11-24 24-24h80c13 0 24 11 24 24v16c0 13-11 24-24 24m-176 0h-80a24 24 0 01-24-24v-16c0-13 11-24 24-24h80c13 0 24 11 24 24v16c0 13-11 24-24 24m-176 0H44a24 24 0 01-24-24v-16c0-13 11-24 24-24h80c13 0 24 11 24 24v16c0 13-11 24-24 24m312 48H84a32 32 0 00-32 32v80c0 18 14 32 32 32h352c18 0 32-14 32-32v-80c0-18-15-32-32-32zm-16 88c0 4-4 8-8 8H108a9 9 0 01-8-8v-32c0-4 4-8 8-8h304c4 0 8 4 8 8v32zm16-392H84a32 32 0 00-32 32v80c0 18 14 32 32 32h352c18 0 32-14 32-32V68c0-18-15-32-32-32zm-16 88c0 4-4 8-8 8H108a9 9 0 01-8-8V92c0-4 4-8 8-8h304c4 0 8 4 8 8v32z" />
    </svg>
  );
}
export default SvgSection;
