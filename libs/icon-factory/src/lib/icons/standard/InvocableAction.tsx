import * as React from 'react';
function SvgInvocableAction(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M628 712v78c0 6 5 11 11 11l6-2 151-123c2-2 3-5 3-8s-2-6-4-8L644 531l-5-1c-6 0-11 5-11 11v83c-93 25-169-57-169-57-2-2-5-3-8-3-6 0-11 5-11 11v2c38 157 188 135 188 135zM382 589l-2-7v-9c0-39 32-71 71-71 19 0 36 7 50 21l1 1 1 1c9 10 35 31 66 40v-25c0-39 32-71 71-71 15 0 25 4 32 8l7 3 6 5 85 72a112 112 0 00-80-190h-6v-10c0-62-51-113-113-113-30 0-56 11-76 30-16-42-57-74-106-74a114 114 0 00-98 170c-50 12-86 56-86 110 0 61 47 110 108 112h74c-4-1-4-2-5-3z" />
    </svg>
  );
}
export default SvgInvocableAction;
