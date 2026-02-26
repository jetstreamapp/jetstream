import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { TITLES } from '@jetstream/shared/constants';
import { acceptInvitation, getUserProfile, verifyInvitation } from '@jetstream/shared/data';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { useTitle } from '@jetstream/shared/ui-utils';
import { TeamInviteVerificationResponse } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  fireToast,
  Page,
  PageHeader,
  PageHeaderRow,
  PageHeaderTitle,
  ScopedNotification,
  Spinner,
} from '@jetstream/ui';
import { abilityState, fromAppState } from '@jetstream/ui/app-state';
import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

const HEIGHT_BUFFER = 170;

export function TeamInvitation() {
  useTitle(TITLES.TEAM);
  const navigate = useNavigate();
  const ability = useAtomValue(abilityState);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [teamVerification, setTeamVerification] = useState<TeamInviteVerificationResponse>();
  const [userProfile, setUserProfile] = useAtom(fromAppState.userProfileState);

  const [searchParams] = useSearchParams();

  const teamId = searchParams.get('teamId');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!teamId || !token) {
      setLoadingError('Your invitation link is invalid.');
      setLoading(false);
      return;
    }

    verifyInvitation({ teamId, token })
      .then((invitation) => {
        if (invitation.success) {
          setTeamVerification(invitation.inviteVerification);
        } else {
          setLoadingError('Your invitation link is invalid or has expired.');
        }
      })
      .catch((error) => {
        setLoadingError(error.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [teamId, token]);

  async function handleAcceptInvitation() {
    if (!teamId || !token) {
      setLoadingError('Your invitation link is invalid or expired.');
      return;
    }

    try {
      setAccepting(true);
      const result = await acceptInvitation({ teamId, token });
      if ('success' in result && result.success) {
        await getUserProfile()
          .then((profile) => {
            setUserProfile(profile);
          })
          .catch(() => {
            logger.warn('Failed to refresh user profile after accepting team invitation');
          });
        if (ability.can('read', 'Team')) {
          navigate('/app/teams');
        } else {
          navigate('/app/home');
        }
        fireToast({
          type: 'success',
          message: 'You have successfully joined the team!',
        });
      } else {
        setLoadingError('An error occurred while accepting the invitation.');
      }
    } catch (error) {
      setLoadingError('An error occurred while accepting the invitation. Please try again later.');
    } finally {
      setAccepting(false);
    }
  }

  return (
    <Page testId="team-invitation-page">
      <PageHeader>
        <PageHeaderRow>
          <PageHeaderTitle icon={{ type: 'standard', icon: 'team_member' }} label="Team Invitation" />
        </PageHeaderRow>
      </PageHeader>
      <AutoFullHeightContainer className="slds-p-around_small slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
        {loading && <Spinner />}
        {loadingError && (
          <ScopedNotification theme="error" className="slds-m-vertical_medium">
            {loadingError}
          </ScopedNotification>
        )}
        {teamVerification && !loading && !loadingError && (
          <div className="slds-align_absolute-center slds-m-top_large">
            <div
              css={css`
                min-width: 50vw;
              `}
              className="slds-text-align_center slds-p-around_large"
            >
              <div className="slds-m-bottom_large">
                <h1 className="slds-text-heading_large slds-text-color_default">Join {teamVerification.teamName}</h1>
                <p className="slds-text-body_regular slds-text-color_weak slds-m-top_small">You've been invited to join your teammates.</p>
              </div>
              {/* Team validation */}
              {
                <div>
                  <ul>
                    {teamVerification.mfa.message && (
                      <li className="slds-text-body_small slds-text-color_error slds-m-bottom_small">{teamVerification.mfa.message}</li>
                    )}
                    {teamVerification.identityProvider.message && (
                      <li className="slds-text-body_small slds-text-color_error slds-m-bottom_small">
                        {teamVerification.identityProvider.message}
                      </li>
                    )}
                    {teamVerification.linkedIdentities.message && (
                      <li className="slds-text-body_small slds-text-color_error slds-m-bottom_small">
                        {teamVerification.linkedIdentities.message}
                      </li>
                    )}
                    {teamVerification.session.message && (
                      <li className="slds-text-body_small slds-text-color_error slds-m-bottom_small">{teamVerification.session.message}</li>
                    )}
                  </ul>
                  {!teamVerification.canEnroll && (
                    <p>
                      <Link to={APP_ROUTES.PROFILE.ROUTE} target="_blank" className="slds-text-link">
                        Update your profile settings
                      </Link>
                    </p>
                  )}
                </div>
              }
              <button
                className="slds-m-top_large slds-button slds-button_brand slds-is-relative slds-size_1-of-1 slds-medium-size_1-of-2 slds-large-size_1-of-3"
                disabled={!teamVerification.canEnroll || accepting}
                type="button"
                onClick={handleAcceptInvitation}
              >
                {accepting ? <Spinner size="small" className="slds-m-right_x-small" /> : 'Accept Invitation'}
              </button>
            </div>
          </div>
        )}
      </AutoFullHeightContainer>
    </Page>
  );
}
