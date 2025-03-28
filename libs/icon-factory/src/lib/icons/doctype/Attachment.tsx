import * as React from 'react';
function SvgAttachment(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5600 6400" aria-hidden="true" {...props}>
      <path fill="#747474" d="M511-3A507 507 0 004 505v5384a507 507 0 00507 507h4578a507 507 0 00507-507V2028L3706-3z" />
      <path fill="#5c5c5c" d="M5598 2035v100H4318s-631-126-613-671c0 0 21 571 600 571z" />
      <path fill="#c9c9c9" d="M3707 0v1456c0 166 111 579 611 579h1280z" />
      <path
        fill="unset"
        d="M2660 4146c113-113 113-299 0-412s-297-113-412 0l-917 916c-113 113-113 299 0 412s299 113 412 0l562-560c32-32 32-85 0-118s-86-32-118 0l-353 353a120 120 0 01-176 0 120 120 0 010-176l351-354c132-130 343-130 472 0 130 132 130 343 0 472l-563 563c-211 216-553 211-766 0-211-213-211-556 0-766l917-917c213-213 556-213 766 0a539 539 0 010 766l-90 90a497 497 0 00-93-261l7-7z"
      />
    </svg>
  );
}
export default SvgAttachment;
