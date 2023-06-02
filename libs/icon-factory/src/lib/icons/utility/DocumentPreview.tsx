import * as React from 'react';
function SvgDocumentPreview(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M17.2 11.6h17.6c.9 0 1.6-.7 1.6-1.6V6.8c0-2.6-2.2-4.8-4.8-4.8H20.4c-2.6 0-4.8 2.2-4.8 4.8V10c0 .9.7 1.6 1.6 1.6zM43.6 6H42c-.5 0-.8.3-.8.8V10c0 3.5-2.9 6.4-6.4 6.4H17.2c-3.5 0-6.4-2.9-6.4-6.4V6.8c0-.5-.3-.8-.8-.8H8.4c-2.6 0-4.8 2.2-4.8 4.8v34.4c0 2.6 2.2 4.8 4.8 4.8h35.2c2.6 0 4.8-2.2 4.8-4.8V10.8c0-2.6-2.2-4.8-4.8-4.8zM15.26 32.63c1.98-3.91 6.13-6.63 10.9-6.63s8.92 2.72 10.9 6.63c.13.25.13.54 0 .74-1.98 3.91-6.13 6.63-10.9 6.63s-8.92-2.72-10.9-6.63a.75.75 0 010-.74zM26.16 38c2.78 0 5-2.22 5-5s-2.22-5-5-5-5 2.22-5 5 2.22 5 5 5zm0-8c1.67 0 3 1.33 3 3s-1.33 3-3 3-3-1.33-3-3 1.33-3 3-3z"
        fill="unset"
        fillRule="evenodd"
      />
    </svg>
  );
}
export default SvgDocumentPreview;
