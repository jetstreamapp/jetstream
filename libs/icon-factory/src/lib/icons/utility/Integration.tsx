import * as React from 'react';
function SvgIntegration(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M22.86 12.03l7.84 7.84c3.25.23 5.77 2.89 5.77 6.21s-2.66 6.12-6.04 6.22l-7.38 7.43c.66.33 1.34.61 2.03.84l.71 4.27c.27 1.42 1.42 2.4 2.93 2.4h2.85c1.42 0 2.67-1.07 2.93-2.49l.71-4.27c2.05-.71 3.91-1.78 5.51-3.29l3.82 1.51c.36.09.71.18 1.07.18 1.07 0 2.05-.53 2.58-1.42l1.33-2.31c.8-.98.44-2.58-.62-3.47l-3.29-2.76c.18-.98.27-2.05.27-3.02s-.09-2.05-.27-3.02l3.29-2.76c1.07-.89 1.42-2.49.71-3.73l-1.42-2.49c-.53-.89-1.51-1.42-2.58-1.42-.36 0-.71.09-.98.18l-4.09 1.51c-1.6-1.42-3.38-2.4-5.25-3.02l-.71-4.18c-.27-1.42-1.51-2.22-2.93-2.22H28.8c-1.42 0-2.67.8-2.93 2.22l-.71 4.09c-.8.26-1.58.59-2.32.98h.02z"
        fill="unset"
      />
      <path
        d="M3.23 28.67h15.08c.8 0 1.16.98.62 1.51l-5.11 5.11c-.53.53-.53 1.33 0 1.87l1.96 1.96c.53.53 1.33.53 1.87 0l12.14-12.23c.53-.53.53-1.33 0-1.87L17.65 12.88c-.53-.53-1.33-.53-1.87 0l-1.87 1.87c-.53.53-.53 1.33 0 1.87l5.11 5.11c.53.62.18 1.6-.62 1.6H3.32c-.71 0-1.33.53-1.33 1.25v2.67c0 .71.53 1.42 1.24 1.42z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgIntegration;
