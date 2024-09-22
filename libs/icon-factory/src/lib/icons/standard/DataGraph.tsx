import * as React from 'react';
function SvgDataGraph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M597.5 474.4a154.2 154.2 0 10-192.6.6l-18.6 32.9-39.7 70.1a113.5 113.5 0 1042.4 23.8l39.6-69.9 18.6-32.9a153.9 153.9 0 00108.1-.3l19 33.6 38.5 68a113.5 113.5 0 1042.9-22.9l-39.1-69.1-19.1-33.8zm-284 277a64.9 64.9 0 100-129.8 64.9 64.9 0 000 129.8zm373 0a64.9 64.9 0 100-129.8 64.9 64.9 0 000 129.8z"
      />
    </svg>
  );
}
export default SvgDataGraph;
