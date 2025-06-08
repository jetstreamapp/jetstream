import { css } from '@emotion/react';
import { Card, Grid, ScopedNotification, Spinner } from '@jetstream/ui';
import { useSessionData } from '../useSessionData';
import { ProfileLoginActivityItem } from './ProfileLoginActivityItem';

export const ProfileLoginActivity = ({ sessionData }: { sessionData: ReturnType<typeof useSessionData> }) => {
  const { errorMessage, isLoading } = sessionData;
  const { currentSessionId, loginActivity } = sessionData.sessions;

  return (
    <Card
      className="slds-is-relative"
      bodyClassName={null}
      title={
        <Grid verticalAlign="center">
          Recent Session Activity{' '}
          {isLoading && !!currentSessionId && (
            <Spinner
              className="slds-m-left_x-small slds-m-top_x-small slds-spinner slds-spinner_brand slds-spinner_x-small slds-spinner_inline"
              hasContainer={false}
            />
          )}
        </Grid>
      }
      icon={{
        type: 'standard',
        icon: 'events',
      }}
      nestedBorder
      css={css`
        max-width: 33rem;
      `}
    >
      {errorMessage && <ScopedNotification theme="error">{errorMessage}</ScopedNotification>}
      {isLoading && !currentSessionId && <Spinner />}
      {loginActivity.map((loginActivity) => (
        <ProfileLoginActivityItem key={`${loginActivity.createdAt}${loginActivity.action}`} loginActivity={loginActivity} />
      ))}
    </Card>
  );
};
