import * as React from 'react';
function SvgStypi(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <path d="M37 0l19 20v38c0 3.31-2.69 6-6 6H6c-3.31 0-6-2.69-6-6V6c0-3.31 2.69-6 6-6h31z" fill="#fcc003" />
      <path d="M37 0l19 20v1H44c-3.87 0-7-3.13-7-7V0z" fill="#e4a201" />
      <path d="M43 20h13L37 0v14c0 3.31 2.69 6 6 6z" fill="#f9e3b6" />
      <path
        d="M30.33 34c.92 0 1.67.74 1.67 1.65v12.06L25.61 54H11.67c-.92 0-1.67-.74-1.67-1.65v-16.7c0-.91.75-1.65 1.67-1.65h18.66zM13.76 46.86v1.71h9.39v-1.71h-9.39zm0-3.72v1.72h14.48v-1.72H13.76zm0-3.71v1.71h14.48v-1.71H13.76z"
        fill="#2e2204"
        fillRule="evenodd"
      />
    </svg>
  );
}
export default SvgStypi;
