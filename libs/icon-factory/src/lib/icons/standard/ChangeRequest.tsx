import * as React from 'react';
function SvgChangeRequest(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M37.5 30h4a.94.94 0 001-1v-3h14v3a.94.94 0 001 1h4a.94.94 0 001-1v-3a6 6 0 00-6-6h-14a6 6 0 00-6 6v3a.94.94 0 001 1zM73.5 36h-48a6 6 0 00-6 6v32a6 6 0 006 6h48a6 6 0 006-6V42a6 6 0 00-6-6zM46.19 58.63l-7.69 7.91a1.19 1.19 0 01-1.35 0l-7.69-7.91c-.58-.48-.1-1.33.86-1.33H35a15 15 0 0115.3-15.24v5.71c-4.81 0-9.53 4.77-9.53 9.53h4.52c1 0 1.48.76.9 1.33zm24.25-.05h-4.71a15.2 15.2 0 01-15.48 15.24v-5.71C56 68.11 60 64.3 60 58.58h-4.66c-1 0-1.44-.76-.86-1.33l7.69-7.9a1.16 1.16 0 011.35 0l7.79 7.9c.58.48.1 1.33-.87 1.33z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgChangeRequest;
