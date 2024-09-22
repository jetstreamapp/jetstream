import * as React from 'react';
function SvgCollection(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M337 203h175v294l4 5 7-1 70-64 5-2 5 2 67 63 8 1 3-5V201h41s26 2 37 14a65 65 0 0120 34v493c0 19-1 29-11 40a57 57 0 01-46 18H342c-3 0-19 3-42-19a67 67 0 01-19-45v-15h-20a39 39 0 01-40-42c1-37 40-38 40-38h20V541h-20a39 39 0 01-40-40 40 40 0 0140-42h20v-97h-20a39 39 0 01-40-39 39 39 0 0140-41h20v-24a60 60 0 0115-36 65 65 0 0141-19z" />
    </svg>
  );
}
export default SvgCollection;
