import * as React from 'react';
function SvgRelationship(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M713 700h-38v-75h38c7 0 12-5 12-12V288c0-8-5-13-12-13H388c-8 0-13 5-13 13v37h-75v-37c0-49 39-88 88-88h325c48 0 87 39 87 88v325c0 48-39 87-87 87zM575 375H250c-27 0-50 22-50 50v325c0 28 23 50 50 50h325c28 0 50-22 50-50V425c0-27-22-50-50-50z" />
    </svg>
  );
}
export default SvgRelationship;
