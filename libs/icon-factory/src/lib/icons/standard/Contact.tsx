import * as React from 'react';
function SvgContact(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M740 290H260c-33 0-60 27-60 60v290c0 33 27 60 60 60h480c33 0 60-27 60-60V350c0-33-27-60-60-60zM486 630H314c-19 0-34-21-34-41 1-30 32-48 65-63 23-10 26-19 26-29s-6-19-14-26a68 68 0 01-21-50c0-38 23-70 63-70s63 32 63 70c0 20-7 38-21 50-8 7-14 16-14 26s3 19 26 28c33 14 64 34 65 64 2 20-13 41-32 41zm234-70c0 11-9 20-20 20h-90c-11 0-20-9-20-20v-30c0-11 9-20 20-20h90c11 0 20 9 20 20v30zm0-110c0 11-9 20-20 20H550c-11 0-20-9-20-20v-30c0-11 9-20 20-20h150c11 0 20 9 20 20v30z" />
    </svg>
  );
}
export default SvgContact;
