import * as React from 'react';
function SvgPdf(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 640" aria-hidden="true" {...props}>
      <path fill="#8e030f" d="M51 0A51 51 0 000 51v538c0 28 23 51 51 51h458c28 0 51-23 51-51V203L371 0z" />
      <path fill="#640103" d="M560 204v10H432s-63-13-61-67c0 0 2 57 60 57z" />
      <path fill="#feb8ab" d="M371 0v146c0 17 11 58 61 58h128z" />
      <path
        fill="unset"
        d="M149 490h-33v41c0 4-3 7-8 7-4 0-7-3-7-7V429c0-6 5-11 11-11h37c24 0 38 17 38 36 0 20-14 36-38 36zm-1-59h-32v46h32c14 0 24-9 24-23s-10-23-24-23zm104 107h-30c-6 0-11-5-11-11v-98c0-6 5-11 11-11h30c37 0 62 26 62 60s-24 60-62 60zm0-107h-26v93h26c29 0 46-21 46-47 1-25-16-46-46-46zm163 0h-58v39h57c4 0 6 3 6 7s-3 6-6 6h-57v48c0 4-3 7-8 7-4 0-7-3-7-7V429c0-6 5-11 11-11h62c4 0 6 3 6 7 1 3-2 6-6 6z"
      />
    </svg>
  );
}
export default SvgPdf;
