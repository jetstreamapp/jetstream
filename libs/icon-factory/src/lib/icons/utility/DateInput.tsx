import * as React from 'react';
function SvgDateInput(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M463 197H57c-9 0-16 7-16 16v235c0 26 21 47 47 47h344c26 0 47-21 47-47V213c0-9-7-16-16-16zM182 416c0 9-7 16-16 16h-31c-9 0-16-7-16-16v-31c0-9 7-16 16-16h31c9 0 16 7 16 16zm109 0c0 9-7 16-16 16h-31c-9 0-16-7-16-16v-31c0-9 7-16 16-16h31c9 0 16 7 16 16zm0-109c0 9-7 16-16 16h-31c-9 0-16-7-16-16v-31c0-9 7-16 16-16h31c9 0 16 7 16 16zm110 0c0 9-7 16-16 16h-31c-9 0-16-7-16-16v-31c0-9 7-16 16-16h31c9 0 16 7 16 16zm31-235h-39V56c0-17-14-31-31-31a31 31 0 00-31 31v16H190V56c0-17-14-31-31-31s-31 14-31 31v16H88a47 47 0 00-47 47v16c0 9 7 16 16 16h407c9 0 16-7 16-16v-16a48 48 0 00-48-47z" />
    </svg>
  );
}
export default SvgDateInput;
