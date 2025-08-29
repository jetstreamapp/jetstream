import { logger } from '@jetstream/shared/client-logger';
import { TITLES } from '@jetstream/shared/constants';
import { acceptInvitation, getUserProfile, verifyInvitation } from '@jetstream/shared/data';
import { useTitle } from '@jetstream/shared/ui-utils';
import { AutoFullHeightContainer, Page, PageHeader, PageHeaderRow, PageHeaderTitle, ScopedNotification, Spinner } from '@jetstream/ui';
import { abilityState, fromAppState } from '@jetstream/ui/app-state';
import { useAtom, useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const HEIGHT_BUFFER = 170;

export function TeamInvitation() {
  useTitle(TITLES.TEAM);
  const navigate = useNavigate();
  const ability = useAtomValue(abilityState);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [team, setTeam] = useState<{ teamName: string }>();
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
          setTeam({ teamName: invitation.teamName });
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
        {team && !loading && !loadingError && (
          <div className="slds-align_absolute-center slds-m-top_large">
            <div className="slds-text-align_center slds-p-around_large">
              <div className="slds-m-bottom_large">
                <h1 className="slds-text-heading_large slds-text-color_default">Join {team.teamName}</h1>
                <p className="slds-text-body_regular slds-text-color_weak slds-m-top_small">
                  You've been invited to join your team {team.teamName}.
                </p>
              </div>
              <div className="slds-m-top_large">
                <button
                  className="slds-button slds-button_brand slds-is-relative slds-size_1-of-1 slds-max-medium-size_1-of-3"
                  disabled={accepting}
                  type="button"
                  onClick={handleAcceptInvitation}
                >
                  {accepting ? <Spinner size="small" className="slds-m-right_x-small" /> : 'Accept Invitation'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AutoFullHeightContainer>
    </Page>
  );
}
