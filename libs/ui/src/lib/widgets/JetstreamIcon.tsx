import { SerializedStyles } from '@emotion/react';
import { FunctionComponent } from 'react';

export interface JetstreamIconProps {
  className?: string;
  css?: SerializedStyles;
  inverse?: boolean;
}

export const JetstreamIcon: FunctionComponent<JetstreamIconProps> = ({ css, className, inverse }) => {
  return inverse ? (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 1314 2102"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      xmlSpace="preserve"
      className={className}
      style={{
        fillRule: 'evenodd',
        clipRule: 'evenodd',
        strokeLinejoin: 'round',
        strokeMiterlimit: 2,
      }}
      css={css}
    >
      <rect x="0" y="1403.55" width="1031.09" height="223.244" style={{ fill: '#e4e4e4' }} />
      <rect x="316.709" y="957.063" width="714.382" height="223.244" style={{ fill: '#e4e4e4' }} />
      <rect x="525.071" y="465.926" width="506.02" height="223.244" style={{ fill: '#e4e4e4' }} />
      <path
        d="M773.914,1937.55c94.953,-7.144 178.595,-33.338 228.006,-89.298c57.151,-66.378 78.582,-156.866 78.582,-432.498l0,-961.737l208.362,0l-0,1043.59c-0,223.542 -35.719,368.502 -138.114,473.278c-92.572,92.572 -244.676,130.672 -357.191,130.672l-19.645,-164.01Zm539.06,-1806.79c0.089,1.964 0.149,3.958 0.149,5.923c-0,67.45 -55.513,122.933 -122.933,122.933c-2.739,0 -5.477,-0.089 -8.186,-0.268c-1.101,0.03 -2.203,0.03 -3.334,0.03c-68.58,0 -125.016,-56.406 -125.016,-125.017c-0,-1.19 0.029,-2.411 0.059,-3.601c-0.03,-0.923 -0.03,-1.846 -0.03,-2.769c0,-70.217 57.776,-127.993 127.994,-127.993c1.696,0 3.393,0.03 5.09,0.089c0.863,-0.029 1.726,-0.029 2.56,-0.029c67.955,-0 123.826,55.9 123.826,123.826c-0,2.292 -0.06,4.584 -0.179,6.876Z"
        style={{
          fill: '#fff',
          fillRule: 'nonzero',
        }}
      />
    </svg>
  ) : (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 1334 2134"
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      xmlnsXlink="http://www.w3.org/1999/xlink"
      xmlSpace="preserve"
      className={className}
      style={{
        fillRule: 'evenodd',
        clipRule: 'evenodd',
        strokeLinejoin: 'round',
        strokeMiterlimit: 2,
      }}
      css={css}
    >
      <rect x="0" y="1424.77" width="1046.67" height="226.618" style={{ fill: '#666' }} />
      <rect x="321.495" y="971.539" width="725.178" height="226.618" style={{ fill: '#666' }} />
      <rect x="533.005" y="472.979" width="513.667" height="226.618" style={{ fill: '#666' }} />
      <path
        d="M785.609,1966.85c96.388,-7.252 181.294,-33.842 231.452,-90.648c58.015,-67.381 79.77,-159.236 79.77,-439.034l-0,-976.27l211.51,-0l0,1059.36c0,226.92 -36.259,374.071 -140.201,480.43c-93.971,93.971 -248.373,132.647 -362.589,132.647l-19.942,-166.488Zm547.207,-1834.1c0.097,2.004 0.145,4.011 0.145,6.017c0,68.459 -56.333,124.791 -124.791,124.791c-2.77,0 -5.539,-0.092 -8.303,-0.276c-1.126,0.03 -2.251,0.045 -3.377,0.045c-69.619,-0 -126.906,-57.288 -126.906,-126.906c-0,-1.224 0.017,-2.448 0.053,-3.671c-0.021,-0.941 -0.031,-1.882 -0.031,-2.822c0,-71.277 58.652,-129.928 129.928,-129.928c1.723,-0 3.446,0.034 5.167,0.103c0.87,-0.018 1.741,-0.027 2.611,-0.027c68.956,-0 125.698,56.742 125.698,125.697c-0,2.327 -0.065,4.654 -0.194,6.977Z"
        style={{ fillRule: 'nonzero' }}
      />
    </svg>
  );
};

export default JetstreamIcon;
