import * as React from 'react';
function SvgAnnouncement(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M227 454l-13-10c-14-10-14-30-14-40v-29c0-8-7-15-15-15h-60c-8 0-15 7-15 15v77c0 27 16 48 41 48h49c29 0 31-20 31-20s5-18-4-26zm223-274V43c0-24-30-31-46-15l-89 84a76 76 0 01-50 17H113a97 97 0 00-93 98v2a90 90 0 0093 91h152a80 80 0 0151 20l88 86c16 16 46 10 46-14V276c30 0 48-21 48-48s-18-48-48-48z" />
    </svg>
  );
}
export default SvgAnnouncement;
