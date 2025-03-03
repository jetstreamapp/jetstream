import * as React from 'react';
function SvgAnnouncement(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M460 743l-16-13c-18-12-18-37-18-50v-36c0-10-9-19-19-19h-75c-10 0-19 9-19 19v96c0 34 20 60 51 60h62c36 0 39-25 39-25s6-22-5-32zm280-342V230c0-30-38-39-58-19L570 316a96 96 0 01-63 21H317c-66 1-117 57-117 122v2c0 65 51 114 117 114h191c24 0 46 10 64 25l110 107c20 20 58 12 58-17V520c38 0 60-26 60-60 0-33-23-59-60-59z" />
    </svg>
  );
}
export default SvgAnnouncement;
