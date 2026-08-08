import * as React from 'react';
function SvgPeopleScore(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M480 770c10 0 16-13 10-20a196 196 0 01-21-233c20-36 45-51 64-80a183 183 0 0017-160c-20-51-67-81-122-80s-100 33-118 85c-20 56-11 124 34 166 19 17 35 44 26 70-2 5-8 13-22 19-57 25-116 55-142 97a117 117 0 00-15 78l1 8a60 60 0 0028 41c6 3 20 8 48 8h210z" />
      <path
        fillRule="evenodd"
        d="M791 620a150 150 0 11-300-2 150 150 0 11300 2m-51-58c7 7 8 19 0 26l-56 60c-3 4-8 6-14 6-5 0-10-2-13-6l-25-28-42 44c-8 7-20 7-27 0s-7-20 0-27l57-56c3-3 8-5 13-5s10 2 14 6l23 26 43-45c7-7 19-8 27 0z"
      />
    </svg>
  );
}
export default SvgPeopleScore;
