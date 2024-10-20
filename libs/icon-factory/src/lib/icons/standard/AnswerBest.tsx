import * as React from 'react';
function SvgAnswerBest(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M495 215c-166 0-300 125-300 280 0 50 14 96 38 137 3 5 4 11 2 16l-28 89c-5 16 10 30 26 25l88-31c6-2 12-1 17 2 46 27 100 42 158 42 166 0 300-125 300-280-1-155-135-280-301-280zm144 218L486 586a29 29 0 01-42 0l-74-74c-6-6-6-15 0-21l21-21c6-6 15-6 21 0l53 53 132-132c6-6 15-6 21 0l21 21c6 6 6 16 0 21z" />
      <path
        fillOpacity={0.65}
        d="M1000 1000V620l-380 380zm-42-135l-31 32-1 3 7 45c1 3-3 6-5 4l-38-21h-3l-40 21c-3 1-6-1-5-4l7-45-1-3-31-32c-2-3-1-6 2-7l43-7 3-2 19-41c1-3 5-3 7 0l19 41 3 2 43 7c4 0 4 4 2 7z"
      />
    </svg>
  );
}
export default SvgAnswerBest;
