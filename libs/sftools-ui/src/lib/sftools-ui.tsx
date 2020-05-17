import React from 'react';

import styled from '@emotion/styled';

/* eslint-disable-next-line */
export interface SftoolsUiProps {}

const StyledSftoolsUi = styled.div`
  color: pink;
`;

export const SftoolsUi = (props: SftoolsUiProps) => {
  return (
    <StyledSftoolsUi>
      <h1>Welcome to sftools-ui!</h1>
    </StyledSftoolsUi>
  );
};

export default SftoolsUi;
