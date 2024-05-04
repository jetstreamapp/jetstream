import styled from '@emotion/styled';

/* eslint-disable-next-line */
export interface UiCoreWorkerProps {}

const StyledUiCoreWorker = styled.div`
  color: pink;
`;

export function UiCoreWorker(props: UiCoreWorkerProps) {
  return (
    <StyledUiCoreWorker>
      <h1>Welcome to UiCoreWorker!</h1>
    </StyledUiCoreWorker>
  );
}

export default UiCoreWorker;
