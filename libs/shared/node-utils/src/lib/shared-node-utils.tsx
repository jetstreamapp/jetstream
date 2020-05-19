import React from 'react';

import styled from '@emotion/styled';

/* eslint-disable-next-line */
export interface SharedNodeUtilsProps {}

const StyledSharedNodeUtils = styled.div`
  color: pink;
`;

export const SharedNodeUtils = (props: SharedNodeUtilsProps) => {
  return (
    <StyledSharedNodeUtils>
      <h1>Welcome to shared-node-utils!</h1>
    </StyledSharedNodeUtils>
  );
};

export default SharedNodeUtils;
