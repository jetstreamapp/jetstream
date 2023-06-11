import * as React from 'react';
function SvgArticle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path fill="unset" d="M32 59h13c1.1 0 2-.9 2-2V27c0-2.2-2-4-4-4H32.3C31 23 30 24 30 25.3V57c0 1.1.9 2 2 2z" />
      <path
        fill="unset"
        d="M76 29v32c0 2.2-1.8 4-4 4H28c-2.2 0-4-1.8-4-4V29c-3.3 0-6 2.7-6 6v30c0 3.3 2.7 6 6 6h19c1.1 0 2 .9 2 2s.9 2 2 2h6c1.1 0 2-.9 2-2s.9-2 2-2h19c3.3 0 6-2.7 6-6V35c0-3.3-2.7-6-6-6z"
      />
      <path fill="unset" d="M55 59h12.7c1.3 0 2.3-1 2.3-2.3V25c0-1.1-.9-2-2-2H57c-2 0-4 1.8-4 4v30c0 1.1.9 2 2 2z" />
    </svg>
  );
}
export default SvgArticle;
