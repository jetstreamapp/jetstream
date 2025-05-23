import * as React from 'react';
function SvgUser(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M500 430v22c0 26-22 48-48 48H68c-26 0-48-22-48-48v-22c0-58 68-94 132-122l6-3c5-2 10-2 15 1a155 155 0 00172 0c5-3 10-3 15-1l6 3c66 28 134 63 134 122zM260 20c66 0 119 59 119 132s-53 132-119 132-119-59-119-132S194 20 260 20z" />
    </svg>
  );
}
export default SvgUser;
